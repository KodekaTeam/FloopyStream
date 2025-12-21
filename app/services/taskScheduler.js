const path = require('path');
const { logInfo } = require('./activityLogger');
const Broadcast = require('../models/Broadcast');
const { startLiveBroadcast, startPlaylistBroadcast } = require('./broadcastEngine');
const Video = require('../models/Video');
const Playlist = require('../models/Playlist');
const { checkBroadcastMetadataSync } = require('./metadataSyncService');
const repeatStreamScheduler = require('./repeatStreamScheduler');
const privateReplayScheduler = require('./privateReplayScheduler');

/**
 * Task Scheduler Service
 * Manages scheduled broadcasts and automated tasks
 */

let schedulerInterval = null;
const scheduledTasks = new Map();

/**
 * Check and start scheduled broadcasts
 */
async function checkScheduledBroadcasts() {
  try {
    const scheduledBroadcasts = await Broadcast.getScheduledBroadcasts();
    const now = Date.now();

    for (const broadcast of scheduledBroadcasts) {
      const scheduledTimeDate = require('../utils/datetime').parseTimestampToDate(broadcast.scheduled_time);
      const scheduledTime = scheduledTimeDate.getTime();

      // Check if it's time to start (within 1 minute window)
      if (scheduledTime <= now && (now - scheduledTime) < 60000) {
        await logInfo('Starting scheduled broadcast', { 
          broadcastId: broadcast.broadcast_id,
          platform: broadcast.platform_name,
          contentType: broadcast.content_type 
        });

        try {
          // Check content type
          if (broadcast.content_type === 'playlist') {
            // Get playlist with videos
            const Playlist = require('../models/Playlist');
            const playlist = await Playlist.findByIdWithVideos(broadcast.content_id);
            
            if (!playlist || !playlist.videos || playlist.videos.length === 0) {
              throw new Error('Playlist not found or empty for scheduled broadcast');
            }
            
            await logInfo('Starting scheduled playlist broadcast', {
              broadcastId: broadcast.broadcast_id,
              playlistId: broadcast.content_id,
              videoCount: playlist.videos.length,
              playbackMode: playlist.playback_mode
            });

            // Start playlist broadcast with Advanced Settings
            await startPlaylistBroadcast(
              broadcast.broadcast_id,
              playlist.videos,
              broadcast.destination_url,
              broadcast.stream_key,
              false, // shuffle
              true,  // loop
              {
                bitrate: broadcast.bitrate,
                frame_rate: broadcast.frame_rate,
                resolution: broadcast.resolution,
                orientation: broadcast.orientation
              },
              broadcast.user_uuid // user UUID for notifications
            );
            
            // Send schedule notification
            if (broadcast.user_uuid) {
              try {
                const NotificationService = require('./notificationService');
                await NotificationService.sendToUserChannels(broadcast.user_uuid, 'schedule', {
                  name: broadcast.broadcast_name || 'Scheduled Broadcast',
                  scheduledTime: broadcast.scheduled_time,
                  description: `Playlist with ${playlist.videos.length} videos started automatically`
                });
              } catch (notificationError) {
                console.error('Scheduled playlist notification failed:', notificationError);
              }
            }
          } else {
            // Get video by UUID (new structure)
            const video = await Video.findByUuid(broadcast.video_uuid);
            
            if (!video) {
              throw new Error('Video not found for scheduled broadcast');
            }

            // Handle filepath - prefer converted 'stream_<filename>' if present
            const fs = require('fs');
            const originalFilename = video.filepath || video.filename;
            const convertedFilename = `stream_${originalFilename}`;

            const candidateConverted = path.join(__dirname, '..', 'storage', 'uploads', convertedFilename);
            const candidateOriginal = path.join(__dirname, '..', 'storage', 'uploads', originalFilename);

            let videoPath;
            if (fs.existsSync(candidateConverted)) {
              videoPath = candidateConverted;
              console.log(`Using converted streaming file for scheduled broadcast: ${convertedFilename}`);
            } else if (fs.existsSync(candidateOriginal)) {
              videoPath = candidateOriginal;
            } else if (originalFilename.startsWith('storage/uploads/') || originalFilename.startsWith('storage\\uploads\\')) {
              videoPath = path.join(__dirname, '..', originalFilename);
            } else {
              videoPath = candidateOriginal;
            }

            await logInfo('Starting scheduled video broadcast', {
              broadcastId: broadcast.broadcast_id,
              videoUuid: broadcast.video_uuid,
              videoTitle: video.video_title,
              videoPath: videoPath
            });

            // Start single video broadcast with Advanced Settings
            await startLiveBroadcast(
              broadcast.broadcast_id,
              videoPath,
              broadcast.destination_url,
              broadcast.stream_key,
              broadcast.duration_timeout,
              {
                bitrate: broadcast.bitrate,
                frame_rate: broadcast.frame_rate,
                resolution: broadcast.resolution,
                orientation: broadcast.orientation
              },
              {}, // options
              broadcast.user_uuid // user UUID for notifications
            );
            
            // Send schedule notification
            if (broadcast.user_uuid) {
              try {
                const NotificationService = require('./notificationService');
                await NotificationService.sendToUserChannels(broadcast.user_uuid, 'schedule', {
                  name: broadcast.broadcast_name || 'Scheduled Broadcast',
                  scheduledTime: broadcast.scheduled_time,
                  description: `Video "${video.video_title}" started automatically`
                });
              } catch (notificationError) {
                console.error('Scheduled video notification failed:', notificationError);
              }
            }
          }

          await logInfo('Scheduled broadcast started', { 
            broadcastId: broadcast.broadcast_id 
          });
        } catch (error) {
          await Broadcast.updateStatus(
            broadcast.broadcast_id, 
            'failed', 
            `Scheduler error: ${error.message}`
          );
          console.error('Error starting scheduled broadcast:', error);
          
          // Send error notification for scheduled broadcast failure
          if (broadcast.user_uuid) {
            try {
              const NotificationService = require('./notificationService');
              await NotificationService.sendToUserChannels(broadcast.user_uuid, 'error', {
                message: 'Scheduled broadcast failed to start',
                details: `Broadcast "${broadcast.broadcast_name}" failed: ${error.message}`
              });
            } catch (notificationError) {
              console.error('Scheduled broadcast error notification failed:', notificationError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking scheduled broadcasts:', error.message);
  }
}

/**
 * Check for expired OAuth tokens and disconnect them automatically
 */
async function checkExpiredOAuthTokens() {
  try {
    const { fetchAll, executeQuery } = require('../core/database');

    // Get all OAuth records with expiry dates
    const oauthRecords = await fetchAll(`
      SELECT oauth_uuid, channel_uuid, provider, expiry_date, access_token, refresh_token
      FROM oauth_credentials
      WHERE expiry_date IS NOT NULL AND access_token IS NOT NULL
    `);

    const now = new Date();
    let disconnectedCount = 0;

    for (const oauth of oauthRecords) {
      const expiryDate = new Date(oauth.expiry_date);

      // Add 5 minute buffer before expiry
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      const effectiveExpiry = new Date(expiryDate.getTime() - bufferTime);

      if (now >= effectiveExpiry) {
        let refreshError = null; // Initialize for later check
        try {
          // Check if token can be refreshed (has refresh token)
          if (oauth.refresh_token && oauth.provider === 'google') {
            // Try to refresh the token
            const { google } = require('googleapis');
            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`
            );

            oauth2Client.setCredentials({
              refresh_token: oauth.refresh_token
            });

            try {
              console.log(`[DEBUG] Attempting to refresh token for ${oauth.oauth_uuid}`);
              console.log(`[DEBUG] Has refresh_token: ${!!oauth.refresh_token}`);
              console.log(`[DEBUG] CLIENT_ID exists: ${!!process.env.GOOGLE_CLIENT_ID}`);
              console.log(`[DEBUG] CLIENT_SECRET exists: ${!!process.env.GOOGLE_CLIENT_SECRET}`);
              console.log(`[DEBUG] REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`}`);
              
              // Refresh token (handle different googleapis return shapes)
              let refreshResult;
              if (typeof oauth2Client.refreshAccessToken === 'function') {
                refreshResult = await oauth2Client.refreshAccessToken();
              } else if (typeof oauth2Client.refreshToken === 'function') {
                refreshResult = await oauth2Client.refreshToken(oauth.refresh_token);
              } else {
                refreshResult = await oauth2Client.getAccessToken();
              }

              const newTokens = (refreshResult && refreshResult.credentials)
                || (refreshResult && refreshResult.tokens)
                || oauth2Client.credentials
                || {};

              const accessToken = newTokens.access_token
                || (refreshResult && refreshResult.token)
                || (typeof refreshResult === 'string' ? refreshResult : null)
                || oauth2Client.credentials?.access_token;

              if (!accessToken) {
                throw new Error('OAuth refresh succeeded but no access_token was returned');
              }

              console.log(`[DEBUG] Token refresh successful, updating database...`);

              // Update the token in database
              await executeQuery(`
                UPDATE oauth_credentials
                SET access_token = ?, refresh_token = ?, token_type = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE oauth_uuid = ?
              `, [
                accessToken,
                newTokens.refresh_token || oauth.refresh_token,
                newTokens.token_type,
                newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null,
                oauth.oauth_uuid
              ]);

              await logInfo('OAuth token refreshed automatically', {
                oauthUuid: oauth.oauth_uuid,
                provider: oauth.provider,
                channelUuid: oauth.channel_uuid
              });

              console.log(`✓ Refreshed OAuth token for ${oauth.provider} connection ${oauth.oauth_uuid}`);
              continue; // Token refreshed, skip disconnection
            } catch (err) {
              refreshError = err; // Capture error for later check
              console.error(`[ERROR] Failed to refresh token for ${oauth.oauth_uuid}:`);
              console.error(`[ERROR] Error message: ${refreshError.message}`);
              console.error(`[ERROR] Error code: ${refreshError.code}`);
              console.error(`[ERROR] Full error:`, JSON.stringify(refreshError, null, 2));
              // Continue to disconnect if refresh fails
            }
          }

          // Determine reason for disconnection
          let disconnectionReason = 'Token expired';
          if (refreshError && refreshError.message && refreshError.message.includes('invalid_grant')) {
            disconnectionReason = 'Refresh token invalid/revoked - User needs to reconnect OAuth';
          }

          // Disconnect the OAuth connection
          await executeQuery(
            'DELETE FROM oauth_credentials WHERE oauth_uuid = ?',
            [oauth.oauth_uuid]
          );

          disconnectedCount++;

          await logInfo('OAuth token disconnected', {
            oauthUuid: oauth.oauth_uuid,
            provider: oauth.provider,
            channelUuid: oauth.channel_uuid,
            expiryDate: oauth.expiry_date,
            reason: disconnectionReason
          });

          console.log(`✓ Disconnected ${oauth.provider} OAuth connection ${oauth.oauth_uuid} - Reason: ${disconnectionReason}`);

        } catch (error) {
          console.error(`Error processing expired OAuth token ${oauth.oauth_uuid}:`, error);
        }
      }
    }

    if (disconnectedCount > 0) {
      console.log(`✓ Cleaned up ${disconnectedCount} expired OAuth tokens`);
    }

  } catch (error) {
    console.error('Error checking expired OAuth tokens:', error);
  }
}

/**
 * Start the scheduler
 */
function startScheduler(intervalSeconds = 30) {
  if (schedulerInterval) {
    console.log('Scheduler is already running');
    return;
  }

  console.log(`✓ Task scheduler started (interval: ${intervalSeconds}s)`);
  
  // Initial checks
  checkScheduledBroadcasts();
  checkExpiredOAuthTokens();

  // Start repeat stream scheduler
  repeatStreamScheduler.start();

  // Start private replay scheduler
  privateReplayScheduler.start();

  // Set up periodic checks
  schedulerInterval = setInterval(() => {
    checkScheduledBroadcasts();
    checkExpiredOAuthTokens();
    checkBroadcastMetadataSync();
  }, intervalSeconds * 1000);

  logInfo('Task scheduler started', { interval: intervalSeconds });
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('✓ Task scheduler stopped');
    logInfo('Task scheduler stopped');
  }

  // Stop repeat stream scheduler
  repeatStreamScheduler.stop();

  // Stop private replay scheduler
  privateReplayScheduler.stop();
}

/**
 * Schedule a one-time task
 */
function scheduleTask(taskId, executeAt, callback) {
  const now = Date.now();
  const executeTime = require('../utils/datetime').parseTimestampToDate(executeAt).getTime();
  const delay = executeTime - now;

  if (delay <= 0) {
    // Execute immediately if time has passed
    callback();
    return;
  }

  const timeoutId = setTimeout(() => {
    callback();
    scheduledTasks.delete(taskId);
  }, delay);

  scheduledTasks.set(taskId, timeoutId);
  
  console.log(`Task scheduled: ${taskId} at ${executeAt}`);
}

/**
 * Cancel a scheduled task
 */
function cancelTask(taskId) {
  const timeoutId = scheduledTasks.get(taskId);
  
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledTasks.delete(taskId);
    console.log(`Task cancelled: ${taskId}`);
    return true;
  }
  
  return false;
}

/**
 * Get scheduled task count
 */
function getScheduledTaskCount() {
  return scheduledTasks.size;
}

/**
 * Cleanup on shutdown
 */
function cleanup() {
  stopScheduler();
  
  // Clear all scheduled tasks
  for (const [taskId, timeoutId] of scheduledTasks) {
    clearTimeout(timeoutId);
  }
  scheduledTasks.clear();
  
  console.log('✓ Scheduler cleanup completed');
}

// Cleanup on process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  startScheduler,
  stopScheduler,
  checkScheduledBroadcasts,
  checkExpiredOAuthTokens,
  scheduleTask,
  cancelTask,
  getScheduledTaskCount
};
