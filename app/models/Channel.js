const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * Channel Model - Manages streaming channels
 * Channels belong to projects and can have multiple platforms (YouTube, Facebook, etc)
 * 
 * Schema:
 * - channel_id (PK): Unique identifier
 * - channel_uuid (unique): UUID for external references
 * - project_uuid: FK to projects table
 * - channel_platform: Platform type (youtube, facebook, twitch, tiktok, internal)
 * - channel_name: Display name of the channel
 * - external_id: ID on external platform
 * - created_at, updated_at: Timestamps
 */
class Channel {
  /**
   * Create a new channel
   * 
   * @param {string} projectUuid - Project UUID
   * @param {string} channelName - Channel name
   * @param {string} platform - Channel platform
   * @param {string} externalId - External platform ID (optional)
   * @returns {Promise<Object>} { channelId, channelUuid }
   */
  static async createNew(projectUuid, channelName, platform, externalId = null) {
    const channelUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO channels (
        channel_uuid, project_uuid, channel_name, channel_platform,
        external_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      channelUuid,
      projectUuid,
      channelName,
      platform,
      externalId,
      now,
      now
    ]);

    console.log(`✓ Channel created: ${channelName} (ID: ${result.lastID})`);
    return { channelId: result.lastID, channelUuid };
  }

  /**
   * Find channel by ID
   * 
   * @param {number} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel object
   */
  static async findById(channelId) {
    const sql = `
      SELECT c.*, p.user_uuid, p.project_name
      FROM channels c
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE c.channel_id = ?
    `;
    return await fetchOne(sql, [channelId]);
  }

  /**
   * Find channel by UUID
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<Object|null>} Channel object
   */
  static async findByUuid(channelUuid) {
    const sql = `
      SELECT c.*, p.user_uuid, p.project_name
      FROM channels c
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE c.channel_uuid = ?
    `;
    return await fetchOne(sql, [channelUuid]);
  }

  /**
   * Get all channels for a project
   * 
   * @param {string} projectUuid - Project UUID
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of channels
   */
  static async getByProject(projectUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT c.*,
        COUNT(DISTINCT g.gallery_id) as gallery_count,
        COUNT(DISTINCT v.video_id) as video_count,
        COUNT(DISTINCT b.broadcast_id) as broadcast_count
      FROM channels c
      LEFT JOIN gallery_videos g ON c.channel_uuid = g.channel_uuid
      LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
      LEFT JOIN broadcasts b ON c.channel_uuid = b.channel_uuid
      WHERE c.project_uuid = ?
      GROUP BY c.channel_id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [projectUuid, limit, offset]);
  }

  /**
   * Get channel count for project
   * 
   * @param {string} projectUuid - Project UUID
   * @returns {Promise<number>} Channel count
   */
  static async getCountByProject(projectUuid) {
    const sql = 'SELECT COUNT(*) as total FROM channels WHERE project_uuid = ?';
    const result = await fetchOne(sql, [projectUuid]);
    return result?.total || 0;
  }

  /**
   * Update channel details
   * 
   * @param {number} channelId - Channel ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateDetails(channelId, updates) {
    const allowedFields = ['channel_name', 'channel_platform', 'external_id'];
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
    values.push(channelId);

    const sql = `UPDATE channels SET ${fields.join(', ')} WHERE channel_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Delete channel (and all related data via cascade)
   * 
   * @param {number} channelUuid - Channel ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteChannel(channelUuid) {
    const sql = 'DELETE FROM channels WHERE channel_uuid = ?';
    return await executeQuery(sql, [channelUuid]);
  }

  /**
   * Get channel with all galleries
   * 
   * @param {number} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel with galleries array
   */
  static async getWithGalleries(channelId) {
    const channel = await this.findById(channelId);
    if (!channel) return null;

    const GalleryVideo = require('./GalleryVideo');
    channel.galleries = await GalleryVideo.getByChannel(channel.channel_uuid);
    return channel;
  }

  /**
   * Get channels by platform
   * 
   * @param {string} platform - Platform to filter by
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of channels
   */
  static async getByPlatform(platform, limit = 50) {
    const sql = `
      SELECT c.*,
        COUNT(DISTINCT g.gallery_id) as gallery_count,
        COUNT(DISTINCT v.video_id) as video_count
      FROM channels c
      LEFT JOIN gallery_videos g ON c.channel_uuid = g.channel_uuid
      LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
      WHERE c.channel_platform = ?
      GROUP BY c.channel_id
      ORDER BY c.created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [platform, limit]);
  }

  /**
   * Get channel statistics
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<Object>} Statistics object
   */
  static async getStats(channelUuid) {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM gallery_videos WHERE channel_uuid = ?) as gallery_count,
        (SELECT COUNT(*) FROM videos v
         JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
         WHERE g.channel_uuid = ?) as video_count,
        (SELECT COUNT(*) FROM broadcasts WHERE channel_uuid = ?) as broadcast_count,
        (SELECT COUNT(*) FROM playlists WHERE channel_uuid = ?) as playlist_count,
        (SELECT SUM(v.filesize) FROM videos v
         JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
         WHERE g.channel_uuid = ?) as total_storage_bytes
    `;
    return await fetchOne(sql, [
      channelUuid,
      channelUuid,
      channelUuid,
      channelUuid,
      channelUuid
    ]);
  }

  /**
   * Find channel by external ID
   * 
   * @param {string} externalId - External platform ID
   * @returns {Promise<Object|null>} Channel object
   */
  static async findByExternalId(externalId) {
    const sql = 'SELECT * FROM channels WHERE external_id = ?';
    return await fetchOne(sql, [externalId]);
  }

  /**
   * Search channels by name
   * 
   * @param {string} searchTerm - Search term
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of matching channels
   */
  static async searchByName(searchTerm, limit = 50) {
    const sql = `
      SELECT c.*, p.project_name
      FROM channels c
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE c.channel_name LIKE ?
      ORDER BY c.created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [`%${searchTerm}%`, limit]);
  }

  static async exists(query) {
    const conditions = [];
    const params = [];
    
    if (query.project_uuid) {
      conditions.push('project_uuid = ?');
      params.push(query.project_uuid);
    }
    
    if (conditions.length === 0) {
      throw new Error('No valid query conditions provided');
    }
    
    const sql = `SELECT 1 FROM channels WHERE ${conditions.join(' AND ')} LIMIT 1`;
    const result = await fetchOne(sql, params);
    return !!result;
  }
}

module.exports = Channel;
