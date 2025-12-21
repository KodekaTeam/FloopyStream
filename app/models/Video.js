const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * Video Model - Manages individual video files
 * Stores detailed video information including file paths and metadata
 * 
 * Schema:
 * - video_id (PK): Unique identifier
 * - video_uuid (unique): UUID for external references
 * - gallery_uuid: FK to gallery_videos table
 * - video_title: Title of the video
 * - video_description: Description
 * - filename: Video filename
 * - filepath: Path to video file
 * - filesize: File size in bytes
 * - mimetype: MIME type
 * - duration_seconds: Duration in seconds
 * - thumbnail_path: Path to thumbnail
 * - status: enum('ready', 'uploaded', 'processing', 'live', 'archived')
 * - created_at, updated_at: Timestamps
 */
class Video {
  /**
   * Create new video entry
   * 
   * @param {string} galleryUuid - Gallery UUID
   * @param {Object} videoData - Video data object
   * @param {string} videoData.title - Video title
   * @param {string} videoData.description - Video description
   * @param {string} videoData.filename - Video filename
   * @param {string} videoData.filepath - Path to video file
   * @param {number} videoData.filesize - File size in bytes
   * @param {string} videoData.mimetype - MIME type
   * @param {number} videoData.durationSeconds - Duration in seconds
   * @param {string} videoData.thumbnailPath - Thumbnail path
   * @param {string} status - Status (default: 'ready')
   * @returns {Promise<Object>} { videoId, videoUuid }
   */
  static async createEntry(galleryUuid, videoData, status = 'ready') {
    const videoUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO videos (
        video_uuid, gallery_uuid, video_title, video_description,
        filename, filepath, filesize, mimetype, duration_seconds,
        thumbnail_path, resolution, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      videoUuid,
      galleryUuid,
      videoData.title,
      videoData.description || null,
      videoData.filename,
      videoData.filepath || null,
      videoData.filesize || null,
      videoData.mimetype || null,
      videoData.durationSeconds || null,
      videoData.thumbnailPath || null,
      videoData.resolution || null,
      status,
      now,
      now
    ];

    const result = await executeQuery(sql, params);
    console.log(`✓ Video created: ${videoData.title} (ID: ${result.lastID})`);
    return { videoId: result.lastID, videoUuid };
  }

  /**
   * Find video by ID
   * 
   * @param {number} videoId - Video ID
   * @returns {Promise<Object|null>} Video object
   */
  static async findById(videoId) {
    const sql = `
      SELECT v.*, g.channel_uuid, g.gallery_title
      FROM videos v
      LEFT JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE v.video_id = ?
    `;
    return await fetchOne(sql, [videoId]);
  }

  /**
   * Find video by UUID
   * 
   * @param {string} videoUuid - Video UUID
   * @returns {Promise<Object|null>} Video object
   */
  static async findByUuid(videoUuid) {
    const sql = `
      SELECT v.*, g.channel_uuid, g.gallery_title
      FROM videos v
      LEFT JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE v.video_uuid = ?
    `;
    return await fetchOne(sql, [videoUuid]);
  }

  /**
   * Get all videos for a gallery
   * 
   * @param {string} galleryUuid - Gallery UUID
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of videos
   */
  static async getByGallery(galleryUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM videos
      WHERE gallery_uuid = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [galleryUuid, limit, offset]);
  }

  /**
   * Get all videos for a channel (across all galleries)
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of videos
   */
  static async getByChannel(channelUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT v.*, g.gallery_title
      FROM videos v
      JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE g.channel_uuid = ?
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [channelUuid, limit, offset]);
  }

  /**
   * Get video count for gallery
   * 
   * @param {string} galleryUuid - Gallery UUID
   * @returns {Promise<number>} Video count
   */
  static async getCountByGallery(galleryUuid) {
    const sql = 'SELECT COUNT(*) as total FROM videos WHERE gallery_uuid = ?';
    const result = await fetchOne(sql, [galleryUuid]);
    return result?.total || 0;
  }

  /**
   * Get video count for channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<number>} Video count
   */
  static async getCountByChannel(channelUuid) {
    const sql = `
      SELECT COUNT(*) as total
      FROM videos v
      JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE g.channel_uuid = ?
    `;
    const result = await fetchOne(sql, [channelUuid]);
    return result?.total || 0;
  }

  /**
   * Update video metadata
   * 
   * @param {number} videoId - Video ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateMetadata(videoId, updates) {
    const allowedFields = [
      'video_title',
      'video_description',
      'status',
      'thumbnail_path',
      'duration_seconds',
      'resolution'
    ];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(getCurrentTimestamp());
    values.push(videoId);

    const sql = `UPDATE videos SET ${fields.join(', ')} WHERE video_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Delete video (only if not referenced in playlists or broadcasts)
   * 
   * @param {number} videoId - Video ID
   * @returns {Promise<Object>} Query result
   * @throws {Error} If video is referenced in playlist or broadcast
   */
  static async deleteVideo(videoId) {
    const video = await this.findById(videoId);
    if (!video) throw new Error('Video not found');

    // Check if video is in any playlist
    const inPlaylist = await fetchOne(
      'SELECT COUNT(*) as count FROM playlist_items WHERE video_uuid = ?',
      [video.video_uuid]
    );
    if (inPlaylist.count > 0) {
      throw new Error('Cannot delete video that is in a playlist');
    }

    // Check if video is in any broadcast
    const inBroadcast = await fetchOne(
      'SELECT COUNT(*) as count FROM broadcasts WHERE video_uuid = ?',
      [video.video_uuid]
    );
    if (inBroadcast.count > 0) {
      throw new Error('Cannot delete video that is in a broadcast');
    }

    const sql = 'DELETE FROM videos WHERE video_id = ?';
    return await executeQuery(sql, [videoId]);
  }

  /**
   * Search videos by title
   * 
   * @param {string} searchTerm - Search term
   * @param {string} channelUuid - Filter by channel (optional)
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of matching videos
   */
  static async searchByTitle(searchTerm, channelUuid = null, limit = 50) {
    let sql = `
      SELECT v.*, g.gallery_title, g.channel_uuid
      FROM videos v
      LEFT JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE v.video_title LIKE ?
    `;
    const params = [`%${searchTerm}%`];

    if (channelUuid) {
      sql += ' AND g.channel_uuid = ?';
      params.push(channelUuid);
    }

    sql += ` ORDER BY v.created_at DESC LIMIT ?`;
    params.push(limit);

    return await fetchAll(sql, params);
  }

  /**
   * Update video status
   * 
   * @param {number} videoId - Video ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Query result
   */
  static async updateStatus(videoId, status) {
    const validStatuses = ['ready', 'uploaded', 'processing', 'live', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const sql = `
      UPDATE videos
      SET status = ?, updated_at = ?
      WHERE video_id = ?
    `;
    return await executeQuery(sql, [status, getCurrentTimestamp(), videoId]);
  }

  /**
   * Get storage used by video
   * 
   * @param {number} videoId - Video ID
   * @returns {Promise<number>} Filesize in bytes
   */
  static async getStorageUsed(videoId) {
    const sql = 'SELECT filesize FROM videos WHERE video_id = ?';
    const result = await fetchOne(sql, [videoId]);
    return result?.filesize || 0;
  }

  /**
   * Bulk update video status
   * 
   * @param {Array<number>} videoIds - Array of video IDs
   * @param {string} status - New status
   * @returns {Promise<Object>} Query result
   */
  static async bulkUpdateStatus(videoIds, status) {
    if (videoIds.length === 0) return { changes: 0 };

    const placeholders = videoIds.map(() => '?').join(',');
    const sql = `
      UPDATE videos
      SET status = ?, updated_at = ?
      WHERE video_id IN (${placeholders})
    `;
    const params = [status, getCurrentTimestamp(), ...videoIds];
    return await executeQuery(sql, params);
  }

  /**
   * Get videos by status
   * 
   * @param {string} status - Status to filter by
   * @param {string} channelUuid - Filter by channel (optional)
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of videos
   */
  static async getByStatus(status, channelUuid = null, limit = 50) {
    let sql = `
      SELECT v.*, g.gallery_title, g.channel_uuid
      FROM videos v
      LEFT JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE v.status = ?
    `;
    const params = [status];

    if (channelUuid) {
      sql += ' AND g.channel_uuid = ?';
      params.push(channelUuid);
    }

    sql += ` ORDER BY v.created_at DESC LIMIT ?`;
    params.push(limit);

    return await fetchAll(sql, params);
  }

  static async exists(query) {
    const conditions = [];
    const params = [];
    
    if (query.project_uuid) {
      conditions.push('c.project_uuid = ?');
      params.push(query.project_uuid);
    }
    
    if (conditions.length === 0) {
      throw new Error('No valid query conditions provided');
    }
    
    const sql = `
      SELECT 1 FROM videos v
      JOIN gallery_videos gv ON v.gallery_uuid = gv.gallery_uuid
      JOIN channels c ON gv.channel_uuid = c.channel_uuid
      WHERE ${conditions.join(' AND ')} LIMIT 1
    `;
    const result = await fetchOne(sql, params);
    return !!result;
  }
}

module.exports = Video;
