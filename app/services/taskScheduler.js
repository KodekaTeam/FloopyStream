const path = require('path');
const { logInfo } = require('./activityLogger');
const Broadcast = require('../models/Broadcast');
const { startLiveBroadcast, startPlaylistBroadcast } = require('./broadcastEngine');
const Content = require('../models/Content');

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
              }
            );
          } else {
            // Get regular content
            const content = await Content.findById(broadcast.content_id);
            
            if (!content) {
              throw new Error('Content not found for scheduled broadcast');
            }

            // Handle filepath - prefer converted 'stream_<filename>' if present
            const fs = require('fs');
            const originalFilename = content.filepath;
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

            await logInfo('Starting scheduled content broadcast', {
              broadcastId: broadcast.broadcast_id,
              contentId: broadcast.content_id,
              contentTitle: content.title,
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
              }
            );
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
        }
      }
    }
  } catch (error) {
    console.error('Error checking scheduled broadcasts:', error.message);
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
  
  // Initial check
  checkScheduledBroadcasts();

  // Set up periodic checks
  schedulerInterval = setInterval(() => {
    checkScheduledBroadcasts();
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
  scheduleTask,
  cancelTask,
  getScheduledTaskCount
};
