const { fetchOne, executeQuery } = require('../core/database');
const youtubeService = require('./youtubeService');
const UploadTemplate = require('../models/UploadTemplate');

/**
 * Metadata Sync Service
 * Handles syncing broadcast metadata (tags, category) when broadcast goes live
 */

let syncQueue = new Map(); // broadcast_uuid -> sync data

/**
 * Add broadcast to metadata sync queue
 */
async function addBroadcastForMetadataSync(broadcastUuid, youtubeBroadcastId, templateUuid, channelUuid) {
  console.log('📋 Adding broadcast to metadata sync queue:', {
    broadcastUuid,
    youtubeBroadcastId,
    templateUuid,
    channelUuid
  });

  syncQueue.set(broadcastUuid, {
    broadcastUuid,
    youtubeBroadcastId,
    templateUuid,
    channelUuid,
    addedAt: new Date(),
    attempts: 0,
    lastChecked: null
  });

  console.log('✅ Broadcast added to sync queue. Total in queue:', syncQueue.size);
}

/**
 * Remove broadcast from metadata sync queue
 */
function removeBroadcastFromMetadataSync(broadcastUuid) {
  const removed = syncQueue.delete(broadcastUuid);
  if (removed) {
    console.log('🗑️ Removed broadcast from sync queue:', broadcastUuid, 'Total remaining:', syncQueue.size);
  }
  return removed;
}

/**
 * Check and sync metadata for broadcasts that are now live
 */
async function checkBroadcastMetadataSync() {
  if (syncQueue.size === 0) {
    console.log('ℹ️ No broadcasts in metadata sync queue');
    return; // No broadcasts to check
  }

  console.log('🔄 Checking metadata sync for', syncQueue.size, 'broadcast(s)...');

  for (const [broadcastUuid, syncData] of syncQueue) {
    try {
      syncData.attempts++;
      syncData.lastChecked = new Date();

      console.log(`🔍 Checking broadcast ${broadcastUuid} (attempt ${syncData.attempts})`);

      // Get OAuth for this broadcast's channel
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
        [syncData.channelUuid, 'google']
      );

      if (!oauthRecord) {
        console.warn('⚠️ No OAuth found for broadcast channel, skipping:', broadcastUuid);
        continue;
      }

      // Initialize YouTube service with OAuth
      await youtubeService.initializeWithOAuth(oauthRecord);

      // Check broadcast status
      const broadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
        part: 'snippet,status',
        id: syncData.youtubeBroadcastId
      });

      if (!broadcastDetails.data.items || broadcastDetails.data.items.length === 0) {
        console.warn('⚠️ Broadcast not found in YouTube API:', syncData.youtubeBroadcastId);
        continue;
      }

      const broadcastItem = broadcastDetails.data.items[0];
      const lifeCycleStatus = broadcastItem.status?.lifeCycleStatus;
      let videoId = broadcastItem.snippet?.videoId;

      // For broadcasts created in YouTube Studio, videoId may equal broadcastId
      if (!videoId) {
        if (lifeCycleStatus === 'complete') {
          videoId = syncData.youtubeBroadcastId;
          console.log(`📺 Using broadcastId as videoId for completed broadcast: ${videoId}`);
        } else if (lifeCycleStatus === 'live') {
          // For live broadcasts, try using broadcastId as videoId
          videoId = syncData.youtubeBroadcastId;
          console.log(`📺 Using broadcastId as videoId for live broadcast (attempting): ${videoId}`);
        }
      }

      console.log(`📺 Broadcast ${broadcastUuid} status:`, {
        lifeCycleStatus,
        hasVideoId: !!videoId,
        videoId: videoId ? videoId.substring(0, 10) + '...' : null
      });

      // Check if broadcast should be synced
      // Sync when broadcast has a videoId (live, testing, or complete status)
      const shouldSyncMetadata = videoId && (lifeCycleStatus === 'live' || lifeCycleStatus === 'testing' || lifeCycleStatus === 'complete');

      if (shouldSyncMetadata) {
        console.log(`🎬 Processing broadcast ${lifeCycleStatus.toUpperCase()} with videoId: ${videoId.substring(0, 10)}...`);

        // Try to transition testing broadcasts to live if they have videoId
        if (lifeCycleStatus === 'testing' && videoId) {
          try {
            console.log('🔄 Attempting to transition broadcast from testing to live...');
            await youtubeService.youtube.liveBroadcasts.transition({
              id: syncData.youtubeBroadcastId,
              broadcastStatus: 'live',
              part: 'id,status'
            });
            console.log('✅ Successfully transitioned broadcast to live status');

            // Re-check status after transition
            const updatedBroadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
              part: 'snippet,status',
              id: syncData.youtubeBroadcastId
            });

            if (updatedBroadcastDetails.data.items && updatedBroadcastDetails.data.items.length > 0) {
              const updatedItem = updatedBroadcastDetails.data.items[0];
              lifeCycleStatus = updatedItem.status?.lifeCycleStatus;
              console.log(`📺 Broadcast status after transition: ${lifeCycleStatus}`);
            }
          } catch (transitionError) {
            console.warn('⚠️ Failed to transition broadcast to live, proceeding with current status:', transitionError.message);
          }
        } else if (lifeCycleStatus === 'complete') {
          console.log('📺 Broadcast is already complete, proceeding with metadata sync...');
        }

        // If we still don't have videoId after all attempts, we can't sync metadata
        if (!videoId) {
          console.log('⚠️ Cannot sync metadata: no videoId available for broadcast');
          // Continue checking - maybe videoId will appear later
          return;
        }

        // Get template data
        console.log('🔍 Looking for template with UUID:', syncData.templateUuid);
        const template = await UploadTemplate.findByUuid(syncData.templateUuid);
        if (!template) {
          console.warn('⚠️ Template not found for metadata sync:', syncData.templateUuid);
          console.warn('💡 This could mean:');
          console.warn('   1. Template UUID is invalid or malformed');
          console.warn('   2. Template was deleted after broadcast creation');
          console.warn('   3. Template belongs to different channel');
          console.warn('   4. Database connection issue');
          removeBroadcastFromMetadataSync(broadcastUuid);
          continue;
        }

        console.log('✅ Found template for sync:', template.template_name);

        // Get broadcast data for title
        const broadcast = await fetchOne(
          'SELECT broadcast_name, video_uuid FROM broadcasts WHERE broadcast_uuid = ?',
          [broadcastUuid]
        );

        if (!broadcast) {
          console.warn('⚠️ Broadcast not found for metadata sync:', broadcastUuid);
          removeBroadcastFromMetadataSync(broadcastUuid);
          continue;
        }

        console.log('✅ Found broadcast for sync:', broadcast.broadcast_name);

        // Parse template tags
        let tags = [];
        if (Array.isArray(template.template_tags)) {
          tags = template.template_tags;
          console.log('📋 Template has array tags:', tags);
        } else if (typeof template.template_tags === 'string') {
          try {
            const parsed = JSON.parse(template.template_tags);
            tags = Array.isArray(parsed) ? parsed : [template.template_tags];
            console.log('📋 Template has JSON string tags, parsed to:', tags);
          } catch (e) {
            tags = template.template_tags.includes(',') ?
              template.template_tags.split(',').map(tag => tag.trim()) :
              [template.template_tags.trim()];
            console.log('📋 Template has comma-separated string tags, split to:', tags);
          }
        } else {
          console.log('📋 Template has no tags or invalid format');
        }

        // Prepare update data
        const updateData = {
          id: videoId,
          snippet: {}
        };

        // Add title if available
        if (broadcast.broadcast_name) {
          updateData.snippet.title = broadcast.broadcast_name;
          console.log('📝 Adding title to update:', broadcast.broadcast_name);
        }

        // Add description if available
        if (template.template_description) {
          updateData.snippet.description = template.template_description;
          console.log('📝 Adding description to update');
        }

        // Add tags if available
        if (tags.length > 0) {
          updateData.snippet.tags = tags;
          console.log('🏷️ Adding tags to update:', tags);
        } else {
          console.log('🏷️ No tags to add');
        }

        // Add category if available
        if (template.template_category) {
          updateData.snippet.categoryId = template.template_category;
          console.log('📂 Adding category to update:', template.template_category);
        } else {
          console.log('📂 No category to add');
        }

        // Only update if we have metadata to update
        if (Object.keys(updateData.snippet).length > 0) {
          console.log('📤 Syncing YouTube video metadata:', {
            videoId: videoId.substring(0, 10) + '...',
            tags: updateData.snippet.tags,
            categoryId: updateData.snippet.categoryId
          });

          try {
            await youtubeService.youtube.videos.update({
              part: 'snippet',
              requestBody: updateData
            });

            console.log('✅ Successfully synced metadata for broadcast:', broadcastUuid);
            console.log('🎉 Tags and category updated in YouTube Studio!');

            // Now upload thumbnail if available
            try {
              console.log('🖼️ Attempting to upload thumbnail for broadcast:', broadcastUuid);
              
              // Get video data to find thumbnail
              if (broadcast && broadcast.video_uuid) {
                const video = await fetchOne(
                  'SELECT thumbnail_path FROM videos WHERE video_uuid = ?',
                  [broadcast.video_uuid]
                );
                
                if (video && video.thumbnail_path) {
                  const path = require('path');
                  const fs = require('fs');
                  const thumbnailPath = path.resolve(__dirname, '../storage/thumbnails', video.thumbnail_path);
                  
                  console.log('🖼️ Uploading thumbnail from path:', thumbnailPath);
                  
                  if (fs.existsSync(thumbnailPath)) {
                    const thumbnailResult = await youtubeService.uploadThumbnail(videoId, thumbnailPath);
                    if (thumbnailResult.success) {
                      console.log('✅ Successfully uploaded thumbnail for broadcast:', broadcastUuid);
                      console.log('🎉 Thumbnail updated in YouTube Studio!');
                    } else {
                      console.warn('⚠️ Failed to upload thumbnail:', thumbnailResult.error);
                    }
                  } else {
                    console.warn('⚠️ Thumbnail file not found:', thumbnailPath);
                  }
                } else {
                  console.log('ℹ️ No thumbnail available for this broadcast');
                }
              } else {
                console.log('ℹ️ No video data found for thumbnail upload');
              }
            } catch (thumbnailError) {
              console.warn('⚠️ Error uploading thumbnail:', thumbnailError.message);
              // Don't fail the entire sync if thumbnail upload fails
            }

            // Remove from queue after successful sync
            removeBroadcastFromMetadataSync(broadcastUuid);
          } catch (updateError) {
            console.error('❌ Failed to update YouTube video metadata:', {
              videoId: videoId,
              error: updateError.message,
              statusCode: updateError.statusCode,
              details: updateError.errors
            });

            // Don't remove from queue on API error - might be temporary
            // Will retry on next check
          }

        } else {
          console.log('ℹ️ No metadata to sync for broadcast:', broadcastUuid);
          removeBroadcastFromMetadataSync(broadcastUuid);
        }

      } else if (lifeCycleStatus === 'complete' || lifeCycleStatus === 'revoked') {
        // Broadcast ended or revoked, remove from queue
        console.log(`🏁 Broadcast ${broadcastUuid} ended (${lifeCycleStatus}), removing from sync queue`);
        removeBroadcastFromMetadataSync(broadcastUuid);

      } else {
        if (lifeCycleStatus === 'live' || lifeCycleStatus === 'testing') {
          if (!videoId) {
            console.log(`⏳ Broadcast ${broadcastUuid} is ${lifeCycleStatus} but videoId not yet assigned by YouTube (attempt ${syncData.attempts})`);
            console.log('💡 This may be normal - YouTube sometimes takes time to assign videoId after broadcast goes live');
          } else {
            console.log(`⏳ Broadcast ${broadcastUuid} is ${lifeCycleStatus} but waiting for videoId assignment...`);
          }
        } else {
          console.log(`⏳ Broadcast ${broadcastUuid} not live yet (status: ${lifeCycleStatus}), will check again later`);
        }
      }

    } catch (error) {
      console.error(`❌ Error checking metadata sync for broadcast ${broadcastUuid}:`, error.message);

      // Remove from queue after too many failed attempts
      if (syncData.attempts >= 40) { // Max 40 attempts (about 20 minutes with 30s intervals)
        console.warn(`🚫 Removing broadcast ${broadcastUuid} from sync queue after ${syncData.attempts} failed attempts`);
        console.warn('💡 If metadata sync still not working, check:');
        console.warn('   1. YouTube broadcast configuration in YouTube Studio');
        console.warn('   2. Stream key binding is correct');
        console.warn('   3. OAuth permissions for the channel');
        removeBroadcastFromMetadataSync(broadcastUuid);
      }
    }
  }

  // Log queue status for debugging
  if (syncQueue.size > 0) {
    getSyncQueueStatus();
  }
}

/**
 * Get sync queue status for debugging
 */
function getSyncQueueStatus() {
  const queue = Array.from(syncQueue.entries()).map(([uuid, data]) => ({
    broadcastUuid: uuid,
    youtubeBroadcastId: data.youtubeBroadcastId,
    templateUuid: data.templateUuid,
    attempts: data.attempts,
    addedAt: data.addedAt,
    lastChecked: data.lastChecked,
    timeInQueue: Math.floor((new Date() - data.addedAt) / 1000) // seconds
  }));

  console.log('📊 Metadata Sync Queue Status:', {
    total: syncQueue.size,
    queue: queue
  });

  return {
    total: syncQueue.size,
    queue: queue
  };
}

module.exports = {
  addBroadcastForMetadataSync,
  removeBroadcastFromMetadataSync,
  checkBroadcastMetadataSync,
  getSyncQueueStatus
};