const { extractMediaInfo, createThumbnail } = require('../utilities/mediaProcessor');
const Content = require('../models/Content');
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
  static async processMediaFile(contentId, filePath) {
    try {
      console.log(`🔄 Starting background processing for content ${contentId}`);

      // Update status to processing
      await executeQuery(
        "UPDATE content SET status = 'processing' WHERE content_id = ?",
        [contentId]
      );

      // Extract media information
      const mediaInfo = await extractMediaInfo(filePath);

      // Generate thumbnail
      const content = await Content.findById(contentId);
      const thumbnailFilename = `thumb_${content.filename.replace(/\.[^/.]+$/, "")}.jpg`;
      const thumbnailPath = `./storage/thumbnails/${thumbnailFilename}`;
      await createThumbnail(filePath, thumbnailPath);

      // Calculate resolution
      const resolution = mediaInfo.width && mediaInfo.height
        ? `${mediaInfo.width}×${mediaInfo.height}`
        : null;

      // Update content with processed data
      await executeQuery(
        `UPDATE content SET
          duration_seconds = ?,
          thumbnail_path = ?,
          resolution = ?,
          status = 'ready'
         WHERE content_id = ?`,
        [
          mediaInfo.durationSeconds,
          thumbnailFilename,
          resolution,
          contentId
        ]
      );

      console.log(`✅ Background processing completed for content ${contentId}`);
      await logInfo('Media processing completed', { contentId });

    } catch (error) {
      console.error(`❌ Background processing failed for content ${contentId}:`, error);

      // Update status to error
      await executeQuery(
        "UPDATE content SET status = 'error' WHERE content_id = ?",
        [contentId]
      );

      await logError('Media processing failed', {
        contentId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Queue media processing job
   */
  static queueProcessing(contentId, filePath) {
    // Use setTimeout for simple background processing
    // In production, consider using a proper job queue like Bull or Agenda
    setTimeout(() => {
      this.processMediaFile(contentId, filePath);
    }, 100); // Small delay to ensure database transaction completes
  }
}

module.exports = MediaProcessingService;