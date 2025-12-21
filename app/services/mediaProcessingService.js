const { extractMediaInfo, createThumbnail } = require('../utilities/mediaProcessor');
const Video = require('../models/Video');
const { executeQuery } = require('../core/database');
const { logInfo, logError } = require('./activityLogger');

/**
 * Background Media Processing Service
 * Handles asynchronous processing of uploaded media files
 */

class MediaProcessingService {
  /**
   * Process media file in background
   */
  static async processMediaFile(videoId, filePath) {
    try {
      console.log(`🔄 Starting background processing for video ${videoId}`);

      // Update status to processing
      await executeQuery(
        "UPDATE videos SET status = 'processing' WHERE video_id = ?",
        [videoId]
      );

      // Extract media information
      const mediaInfo = await extractMediaInfo(filePath);

      // Generate thumbnail
      const video = await Video.findById(videoId);
      const thumbnailFilename = `thumb_${video.filename.replace(/\.[^/.]+$/, "")}.jpg`;
      const thumbnailPath = `./storage/thumbnails/${thumbnailFilename}`;
      await createThumbnail(filePath, thumbnailPath);

      // Calculate resolution (optional, not in videos table but could be useful)
      const resolution = mediaInfo.width && mediaInfo.height
        ? `${mediaInfo.width}×${mediaInfo.height}`
        : null;

      // Update video with processed data
      await executeQuery(
        `UPDATE videos SET
          duration_seconds = ?,
          thumbnail_path = ?,
          status = 'ready'
         WHERE video_id = ?`,
        [
          mediaInfo.durationSeconds,
          thumbnailFilename,
          videoId
        ]
      );

      console.log(`✅ Background processing completed for video ${videoId}`);
      await logInfo('Media processing completed', { videoId });

    } catch (error) {
      console.error(`❌ Background processing failed for video ${videoId}:`, error);

      // Update status to error
      await executeQuery(
        "UPDATE videos SET status = 'error' WHERE video_id = ?",
        [videoId]
      );

      await logError('Media processing failed', {
        videoId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Queue media processing job
   */
  static queueProcessing(videoId, filePath) {
    // Use setTimeout for simple background processing
    // In production, consider using a proper job queue like Bull or Agenda
    setTimeout(() => {
      this.processMediaFile(videoId, filePath);
    }, 100); // Small delay to ensure database transaction completes
  }
}

module.exports = MediaProcessingService;