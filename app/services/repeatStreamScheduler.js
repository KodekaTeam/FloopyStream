const cron = require('node-cron');
const { executeQuery, fetchAll, fetchOne } = require('../core/database');
const { logInfo, logError } = require('./activityLogger');

function isYouTubeStream(url = '') {
  const ytPatterns = [
    'youtube.com',
    'youtu.be',
    'rtmp.youtube.com',
    'rtsps://a.rtmp.youtube.com'
  ];
  return ytPatterns.some(pattern => String(url).includes(pattern));
}

function calculateNextScheduledTime(scheduledTime, repeatType, now) {
  if (!scheduledTime || !(scheduledTime instanceof Date) || Number.isNaN(scheduledTime.getTime())) {
    return null;
  }

  const next = new Date(scheduledTime);

  const advanceOnce = () => {
    switch (repeatType) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        return true;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        return true;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        return true;
      default:
        return false;
    }
  };

  if (!advanceOnce()) {
    return null;
  }

  // If scheduler was down (or broadcast finished long ago), keep advancing until it's in the future.
  while (next <= now) {
    if (!advanceOnce()) {
      return null;
    }
  }

  return next;
}

/**
 * Repeat Stream Scheduler
 * Handles automatic creation of repeated broadcasts based on repeat_stream settings
 */
class RepeatStreamScheduler {
  constructor() {
    this.isRunning = false;
    this.job = null;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      logInfo('Repeat Stream Scheduler is already running');
      return;
    }

    // Run every minute to check for broadcasts that need to be repeated
    this.job = cron.schedule('* * * * *', async () => {
      try {
        await this.checkAndCreateRepeats();
      } catch (error) {
        logError('Error in repeat stream scheduler:', error);
      }
    });

    this.isRunning = true;
    logInfo('Repeat Stream Scheduler started - checking every minute');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.isRunning = false;
    logInfo('Repeat Stream Scheduler stopped');
  }

  /**
   * Check for broadcasts that need to be repeated and create new ones
   */
  async checkAndCreateRepeats() {
    try {
      // Get current time
      const now = new Date();

      // Find broadcasts with repeat_stream set and scheduled_time in the past
      const sql = `
        SELECT * FROM broadcasts
        WHERE repeat_stream IS NOT NULL
        AND repeat_stream IN ('daily', 'weekly', 'monthly')
        AND scheduled_time IS NOT NULL
        AND broadcast_status IN ('completed', 'offline')
        ORDER BY scheduled_time DESC
      `;

      const broadcasts = await fetchAll(sql);

      for (const broadcast of broadcasts) {
        try {
          const shouldReschedule = await this.shouldRescheduleRepeat(broadcast, now);
          if (shouldReschedule) {
            await this.rescheduleExistingBroadcast(broadcast, now);
          }
        } catch (error) {
          logError(`Error processing repeat for broadcast ${broadcast.broadcast_uuid}:`, error);
        }
      }
    } catch (error) {
      logError('Error checking repeat streams:', error);
    }
  }

  /**
   * Check if a repeat broadcast should be created
   */
  async shouldRescheduleRepeat(broadcast, currentTime) {
    const scheduledTime = new Date(broadcast.scheduled_time);
    if (Number.isNaN(scheduledTime.getTime())) {
      return false;
    }

    // Only reschedule if the original scheduled time has passed
    if (currentTime < scheduledTime) {
      return false;
    }

    const nextScheduledTime = calculateNextScheduledTime(scheduledTime, broadcast.repeat_stream, currentTime);
    if (!nextScheduledTime) {
      return false;
    }

    // Avoid time collisions with other scheduled broadcasts in the same channel.
    // (We are not creating a new record; just preventing accidental overlap.)
    const existing = await fetchAll(
      `
        SELECT broadcast_uuid
        FROM broadcasts
        WHERE channel_uuid = ?
          AND broadcast_status = 'scheduled'
          AND scheduled_time IS NOT NULL
          AND ABS(strftime('%s', scheduled_time) - strftime('%s', ?)) < 60
          AND broadcast_uuid != ?
      `,
      [broadcast.channel_uuid, nextScheduledTime.toISOString(), broadcast.broadcast_uuid]
    );

    return existing.length === 0;
  }

  /**
   * Create a repeat broadcast
   */
  async rescheduleExistingBroadcast(originalBroadcast, currentTime) {
    const scheduledTime = new Date(originalBroadcast.scheduled_time);
    const nextScheduledTime = calculateNextScheduledTime(scheduledTime, originalBroadcast.repeat_stream, currentTime);

    if (!nextScheduledTime) {
      return;
    }

    try {
      let newYouTubeBroadcastId = null;

      // For YouTube, create a NEW YouTube broadcast ID but reuse the SAME stream (same stream key).
      // This mirrors the previous "Handling Youtube Broadcast Reconnection" behavior.
      if (
        originalBroadcast.platform_name === 'youtube' ||
        isYouTubeStream(originalBroadcast.destination_url)
      ) {
        try {
          newYouTubeBroadcastId = await this.createYouTubeBroadcastForReschedule(originalBroadcast, nextScheduledTime);
        } catch (ytError) {
          logError('Failed to create YouTube broadcast for repeat reschedule (continuing with local reschedule):', {
            broadcastUuid: originalBroadcast.broadcast_uuid,
            message: ytError.message
          });
        }
      }

      const updateSql = `
        UPDATE broadcasts
        SET broadcast_status = 'scheduled',
            scheduled_time = ?,
            started_at = NULL,
            ended_at = NULL,
            error_message = NULL,
            ${newYouTubeBroadcastId ? 'youtube_broadcast_id = ?,\n            ' : ''}updated_at = datetime('now')
        WHERE broadcast_uuid = ?
      `;

      const params = newYouTubeBroadcastId
        ? [nextScheduledTime.toISOString(), newYouTubeBroadcastId, originalBroadcast.broadcast_uuid]
        : [nextScheduledTime.toISOString(), originalBroadcast.broadcast_uuid];

      await executeQuery(updateSql, params);

      logInfo('Repeat stream rescheduled (no duplicate broadcast created)', {
        broadcastUuid: originalBroadcast.broadcast_uuid,
        repeatType: originalBroadcast.repeat_stream,
        nextScheduledTime: nextScheduledTime.toISOString(),
        youtubeBroadcastId: newYouTubeBroadcastId || originalBroadcast.youtube_broadcast_id || null
      });
    } catch (error) {
      logError(`Failed to reschedule repeat broadcast ${originalBroadcast.broadcast_uuid}:`, error);
    }
  }

  async createYouTubeBroadcastForReschedule(broadcast, nextScheduledTime) {
    const youtubeService = require('./youtubeService');
    const { sanitizeYouTubeTitle } = require('../utils/youtubeMetadata');

    // Get OAuth for the broadcast's channel
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [broadcast.channel_uuid, 'google']
    );

    if (!oauthRecord) {
      throw new Error('No OAuth credentials found for channel');
    }

    await youtubeService.initializeWithOAuth(oauthRecord);

    // Find existing YouTube stream ID for this stream key (so stream key stays the same)
    const streamKeyRecord = await fetchOne(
      'SELECT * FROM streamkeys WHERE stream_key = ? AND channel_uuid = ? LIMIT 1',
      [broadcast.stream_key, broadcast.channel_uuid]
    );

    const existingYouTubeStreamId = streamKeyRecord?.youtube_stream_id;
    if (!existingYouTubeStreamId) {
      throw new Error('No YouTube stream ID found for this stream key');
    }

    // Optional: load template metadata similar to broadcastEngine's reconnection logic
    let templateSettings = null;
    if (broadcast.template_uuid) {
      try {
        const UploadTemplate = require('../models/UploadTemplate');
        const template = await UploadTemplate.findByUuid(broadcast.template_uuid);

        if (template) {
          const tags = (() => {
            if (Array.isArray(template.template_tags)) {
              return template.template_tags;
            }
            if (typeof template.template_tags === 'string' && template.template_tags.length > 0) {
              try {
                const parsed = JSON.parse(template.template_tags);
                return Array.isArray(parsed) ? parsed : [template.template_tags];
              } catch (e) {
                return template.template_tags.includes(',')
                  ? template.template_tags.split(',').map(tag => tag.trim()).filter(Boolean)
                  : [template.template_tags.trim()].filter(Boolean);
              }
            }
            return [];
          })();

          templateSettings = {
            title: broadcast.broadcast_name || 'FloopyStream Broadcast',
            description: template.template_description || `Broadcast created from FloopyStream on ${new Date().toISOString()}`,
            tags,
            category: template.template_category,
            visibility: template.template_visibility || 'private',
            audience: template.template_audience || 'no',
            language: template.template_language_video || 'en'
          };
        }
      } catch (e) {
        // Template is optional
      }
    }

    const rawBroadcastTitle = templateSettings?.title || broadcast.broadcast_name || 'FloopyStream Broadcast';
    const broadcastTitle = sanitizeYouTubeTitle(rawBroadcastTitle, {
      fallback: 'FloopyStream Broadcast',
      maxLength: 100
    });
    const broadcastDescription = templateSettings?.description || `Broadcast created from FloopyStream on ${new Date().toISOString()}`;

    const broadcastConfig = {
      part: 'id,snippet,status,contentDetails',
      resource: {
        snippet: {
          title: broadcastTitle,
          description: broadcastDescription,
          scheduledStartTime: nextScheduledTime.toISOString(),
          ...(templateSettings?.language && { defaultLanguage: templateSettings.language })
        },
        status: {
          privacyStatus: templateSettings?.visibility || 'private',
          selfDeclaredMadeForKids: templateSettings?.audience === 'yes' || templateSettings?.audience === 'made_for_kids'
        },
        contentDetails: {
          enableAutoStart: broadcast.enable_autostart === 'true',
          enableAutoStop: broadcast.enable_autoend === 'true',
          enableClosedCaptions: false,
          enableDvr: broadcast.enable_dvr === 'true',
          enableEmbed: false,
          recordFromStart: true,
          startWithSlate: false,
          enableContentEncryption: false,
          enableMonitoring: false,
          enableLowLatency: broadcast.enable_360 === 'true',
          // Bind existing stream so Studio immediately shows the correct key
          boundStreamId: existingYouTubeStreamId
        }
      }
    };

    const createResponse = await youtubeService.youtube.liveBroadcasts.insert(broadcastConfig);
    const newBroadcastId = createResponse?.data?.id;
    if (!newBroadcastId) {
      throw new Error('Failed to create YouTube broadcast (no id returned)');
    }

    // Explicit bind (helps propagation in Studio)
    await youtubeService.youtube.liveBroadcasts.bind({
      id: newBroadcastId,
      part: 'id,snippet,status,contentDetails',
      streamId: existingYouTubeStreamId
    });

    // Update streamkey record to point to the new broadcast (stream key stays the same)
    if (streamKeyRecord?.streamkey_id) {
      await executeQuery(
        'UPDATE streamkeys SET youtube_broadcast_id = ?, youtube_stream_id = ?, updated_at = datetime("now"), last_used_at = datetime("now") WHERE streamkey_id = ?',
        [newBroadcastId, existingYouTubeStreamId, streamKeyRecord.streamkey_id]
      );
    }

    // Trigger metadata sync if template exists
    if (broadcast.template_uuid) {
      try {
        const { addBroadcastForMetadataSync } = require('./metadataSyncService');
        await addBroadcastForMetadataSync(broadcast.broadcast_uuid, newBroadcastId, broadcast.template_uuid, broadcast.channel_uuid);
      } catch (e) {
        // metadata sync is optional
      }
    }

    logInfo('YouTube repeat reschedule: created new broadcast ID bound to existing stream', {
      broadcastUuid: broadcast.broadcast_uuid,
      newYouTubeBroadcastId: newBroadcastId,
      existingYouTubeStreamId,
      scheduledStartTime: nextScheduledTime.toISOString()
    });

    return newBroadcastId;
  }
}

// Export singleton instance
module.exports = new RepeatStreamScheduler();