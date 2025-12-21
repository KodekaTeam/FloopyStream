const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * GalleryVideo Model - Manages video galleries per channel
 * Replaces old Content model with new gallery_videos table structure
 * 
 * Schema:
 * - gallery_id (PK): Unique identifier
 * - gallery_uuid (unique): UUID for external references
 * - channel_uuid: FK to channels table
 * - gallery_title: Title of the gallery
 * - gallery_description: Description
 * - thumbnail_path: Path to thumbnail
 * - platform_video_id: ID on external platform (YouTube, etc)
 * - status: enum('active', 'inactive', 'archived')
 * - created_at, updated_at: Timestamps
 */
class GalleryVideo {
  /**
   * Create new gallery video entry
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {Object} galleryData - Gallery data object
   * @param {string} galleryData.title - Gallery title
   * @param {string} galleryData.description - Gallery description (optional)
   * @param {string} galleryData.thumbnailPath - Thumbnail path (optional)
   * @param {string} galleryData.platformVideoId - Platform video ID (optional)
   * @param {string} status - Status (default: 'active')
   * @returns {Promise<Object>} { galleryId, galleryUuid }
   */
  static async createEntry(channelUuid, galleryData, status = 'active') {
    const galleryUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO gallery_videos (
        gallery_uuid, channel_uuid, gallery_title, gallery_description,
        thumbnail_path, platform_video_id, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      galleryUuid,
      channelUuid,
      galleryData.title,
      galleryData.description || null,
      galleryData.thumbnailPath || null,
      galleryData.platformVideoId || null,
      status,
      now,
      now
    ];

    const result = await executeQuery(sql, params);
    console.log(`✓ Gallery video created: ${galleryData.title} (ID: ${result.lastID})`);
    return { galleryId: result.lastID, galleryUuid };
  }

  /**
   * Find gallery by ID
   * 
   * @param {number} galleryId - Gallery ID
   * @returns {Promise<Object|null>} Gallery object
   */
  static async findById(galleryId) {
    const sql = `
      SELECT g.*, c.project_uuid
      FROM gallery_videos g
      LEFT JOIN channels c ON g.channel_uuid = c.channel_uuid
      WHERE g.gallery_id = ?
    `;
    return await fetchOne(sql, [galleryId]);
  }

  /**
   * Find gallery by UUID
   * 
   * @param {string} galleryUuid - Gallery UUID
   * @returns {Promise<Object|null>} Gallery object
   */
  static async findByUuid(galleryUuid) {
    const sql = `
      SELECT g.*, c.project_uuid
      FROM gallery_videos g
      LEFT JOIN channels c ON g.channel_uuid = c.channel_uuid
      WHERE g.gallery_uuid = ?
    `;
    return await fetchOne(sql, [galleryUuid]);
  }

  /**
   * Get all galleries for a channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of galleries
   */
  static async getByChannel(channelUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT g.*, COUNT(v.video_id) as video_count
      FROM gallery_videos g
      LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
      WHERE g.channel_uuid = ?
      GROUP BY g.gallery_id
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [channelUuid, limit, offset]);
  }

  /**
   * Get gallery count for channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<number>} Gallery count
   */
  static async getCountByChannel(channelUuid) {
    const sql = 'SELECT COUNT(*) as total FROM gallery_videos WHERE channel_uuid = ?';
    const result = await fetchOne(sql, [channelUuid]);
    return result?.total || 0;
  }

  /**
   * Update gallery metadata
   * 
   * @param {number} galleryId - Gallery ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateMetadata(galleryId, updates) {
    const allowedFields = ['gallery_title', 'gallery_description', 'status', 'thumbnail_path', 'platform_video_id'];
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
    values.push(galleryId);

    const sql = `UPDATE gallery_videos SET ${fields.join(', ')} WHERE gallery_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Delete gallery (and all associated videos via cascade)
   * 
   * @param {number} galleryId - Gallery ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteGallery(galleryId) {
    const sql = 'DELETE FROM gallery_videos WHERE gallery_id = ?';
    return await executeQuery(sql, [galleryId]);
  }

  /**
   * Search galleries by title
   * 
   * @param {string} searchTerm - Search term
   * @param {string} channelUuid - Filter by channel (optional)
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of matching galleries
   */
  static async searchByTitle(searchTerm, channelUuid = null, limit = 50) {
    let sql = `
      SELECT g.*, COUNT(v.video_id) as video_count
      FROM gallery_videos g
      LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
      WHERE g.gallery_title LIKE ?
    `;
    const params = [`%${searchTerm}%`];

    if (channelUuid) {
      sql += ' AND g.channel_uuid = ?';
      params.push(channelUuid);
    }

    sql += ` GROUP BY g.gallery_id ORDER BY g.created_at DESC LIMIT ?`;
    params.push(limit);

    return await fetchAll(sql, params);
  }

  /**
   * Get gallery with all videos
   * 
   * @param {number} galleryId - Gallery ID
   * @returns {Promise<Object|null>} Gallery with videos array
   */
  static async getWithVideos(galleryId) {
    const gallery = await this.findById(galleryId);
    if (!gallery) return null;

    const Video = require('./Video');
    gallery.videos = await Video.getByGallery(gallery.gallery_uuid);
    return gallery;
  }

  /**
   * Get storage used by gallery videos
   * 
   * @param {number} galleryId - Gallery ID
   * @returns {Promise<number>} Total filesize in bytes
   */
  static async getStorageUsed(galleryId) {
    const sql = `
      SELECT SUM(v.filesize) as total_size
      FROM videos v
      JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE g.gallery_id = ?
    `;
    const result = await fetchOne(sql, [galleryId]);
    return result?.total_size || 0;
  }

  /**
   * Get storage used by channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<number>} Total filesize in bytes
   */
  static async getStorageUsedByChannel(channelUuid) {
    const sql = `
      SELECT SUM(v.filesize) as total_size
      FROM videos v
      JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
      WHERE g.channel_uuid = ?
    `;
    const result = await fetchOne(sql, [channelUuid]);
    return result?.total_size || 0;
  }

  /**
   * Bulk update gallery status
   * 
   * @param {Array<number>} galleryIds - Array of gallery IDs
   * @param {string} status - New status
   * @returns {Promise<Object>} Query result
   */
  static async bulkUpdateStatus(galleryIds, status) {
    if (galleryIds.length === 0) return { changes: 0 };

    const placeholders = galleryIds.map(() => '?').join(',');
    const sql = `
      UPDATE gallery_videos
      SET status = ?, updated_at = ?
      WHERE gallery_id IN (${placeholders})
    `;
    const params = [status, getCurrentTimestamp(), ...galleryIds];
    return await executeQuery(sql, params);
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
      SELECT 1 FROM gallery_videos gv
      JOIN channels c ON gv.channel_uuid = c.channel_uuid
      WHERE ${conditions.join(' AND ')} LIMIT 1
    `;
    const result = await fetchOne(sql, params);
    return !!result;
  }
}

module.exports = GalleryVideo;
