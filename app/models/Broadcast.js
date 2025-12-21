const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { formatForDb } = require("../utils/datetime");

/**
 * Broadcast Model - manages live broadcasts/streams
 * 
 * Updated for new database structure:
 * - Uses channel_uuid instead of account_id
 * - Uses video_uuid for single video broadcasts
 * - Uses broadcast_type (single|playlist) instead of content_type
 * - Associates with channels instead of accounts
 */
class Broadcast {
  /**
   * Create new broadcast with new structure
   * 
   * @param {string} channelUuid - Channel UUID (required)
   * @param {object} broadcastData - Broadcast configuration
   * @returns {object} - { broadcastId, broadcastUuid }
   */
  static async createNew(channelUuid, broadcastData) {
    const broadcastUuid = uuidv4();
    const broadcastName = broadcastData.broadcast_name || 'Untitled Broadcast';
    const broadcastType = broadcastData.broadcast_type || 'single'; // 'single' or 'playlist'
    const initialStatus = broadcastData.scheduled_time ? 'scheduled' : 'offline';

    if (!channelUuid) {
      throw new Error('channelUuid is required to create a broadcast');
    }

    const sql = `
      INSERT INTO broadcasts (
        broadcast_uuid, channel_uuid, video_uuid, playlist_uuid, broadcast_type, platform_name,
        destination_url, stream_key, scheduled_time, broadcast_name, broadcast_status,
        advanced_settings, loopvideo, duration_timeout, enable_autostart, enable_autoend,
        enable_dvr, enable_360, template_uuid, repeat_stream, enable_private_replay, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      broadcastUuid,
      channelUuid,
      broadcastData.broadcast_type === 'single' ? (broadcastData.video_uuid || null) : null, // video_uuid only for single broadcasts
      broadcastData.broadcast_type === 'playlist' ? (broadcastData.video_uuid || null) : null, // playlist_uuid for playlist broadcasts
      broadcastType,
      broadcastData.platform_name,
      broadcastData.destination_url,
      broadcastData.stream_key || null,
      broadcastData.scheduled_time ? formatForDb(broadcastData.scheduled_time) : null,
      broadcastName,
      initialStatus,
      broadcastData.advanced_settings ? JSON.stringify(broadcastData.advanced_settings) : null,
      broadcastData.loopvideo !== undefined ? (broadcastData.loopvideo ? 1 : 0) : 1,
      broadcastData.duration_timeout || null,
      // Convert enable_* fields to strings ('true'/'false') for database TEXT columns
      (broadcastData.enable_autostart === 'true' || broadcastData.enable_autostart === true || broadcastData.enable_autostart === 1) ? 'true' : 'false',
      (broadcastData.enable_autoend === 'true' || broadcastData.enable_autoend === true || broadcastData.enable_autoend === 1) ? 'true' : 'false',
      (broadcastData.enable_dvr === 'true' || broadcastData.enable_dvr === true || broadcastData.enable_dvr === 1) ? 'true' : 'false',
      (broadcastData.enable_360 === 'true' || broadcastData.enable_360 === true || broadcastData.enable_360 === 1) ? 'true' : 'false',
      broadcastData.template_uuid || null,
      broadcastData.repeat_stream || null,
      // Convert enable_private_replay to integer (0 or 1) for database INTEGER column
      (broadcastData.enable_private_replay === 'true' || broadcastData.enable_private_replay === true || broadcastData.enable_private_replay === 1) ? 1 : 0,
      formatForDb(new Date()),
      formatForDb(new Date())
    ];

    const result = await executeQuery(sql, params);
    
    console.log('Broadcast created:', {
      broadcastId: result.lastID,
      broadcastUuid,
      broadcastName,
      channelUuid,
      broadcastType,
      status: initialStatus
    });

    return { broadcastId: result.lastID, broadcastUuid };
  }

  /**
   * Create broadcast (backward compatibility - converts accountId to channels)
   * @deprecated Use createNew with channelUuid instead
   */
  static async createNewLegacy(accountId, broadcastData) {
    console.warn('⚠️ Broadcast.createNewLegacy() is deprecated. Use createNew(channelUuid, data) instead.');
    // This method can redirect to a conversion function if needed
    throw new Error('Legacy createNew method no longer supported. Please provide channelUuid.');
  }

  /**
   * Find broadcast by ID
   */
  static async findById(broadcastId) {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        p.project_name,
        u.user_username,
        v.video_title,
        v.thumbnail_path,
        gv.gallery_title
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN projects p ON ch.project_uuid = p.project_uuid
      LEFT JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid
      LEFT JOIN gallery_videos gv ON b.video_uuid = gv.gallery_uuid
      WHERE b.broadcast_id = ?
    `;
    return await fetchOne(sql, [broadcastId]);
  }

  /**
   * Find broadcast by UUID
   */
  static async findByUuid(broadcastUuid) {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        p.project_name,
        u.user_username,
        v.video_title,
        v.thumbnail_path,
        gv.gallery_title
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN projects p ON ch.project_uuid = p.project_uuid
      LEFT JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid
      LEFT JOIN gallery_videos gv ON b.video_uuid = gv.gallery_uuid
      WHERE b.broadcast_uuid = ?
    `;
    return await fetchOne(sql, [broadcastUuid]);
  }

  /**
   * Get broadcasts by channel
   */
  static async getByChannel(channelUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        v.video_title as video_title,
        v.thumbnail_path as video_thumbnail,
        pl.playlist_uuid as playlist_uuid,
        pl.playlist_name as playlist_name
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid AND b.broadcast_type = 'single'
      LEFT JOIN playlists pl ON b.channel_uuid = pl.channel_uuid AND b.broadcast_type = 'playlist'
      WHERE b.channel_uuid = ?
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [channelUuid, limit, offset]);
  }

  /**
   * Get broadcasts by account (legacy) - converts to channels
   * @deprecated Use getByChannel instead
   */
  static async getByAccount(accountId, limit = 50, offset = 0) {
    console.warn('⚠️ Broadcast.getByAccount() is deprecated. Use getByChannel() instead.');
    // This would need UserAdapter to convert accountId to channels
    // For now, returning empty array
    return [];
  }

  /**
   * Get broadcasts by account with pagination (legacy)
   * @deprecated Use getByChannel instead
   */
  static async getByAccountWithPagination(accountId, limit = 10, offset = 0) {
    return await this.getByAccount(accountId, limit, offset);
  }

  /**
   * Count total broadcasts for a channel
   */
  static async countByChannel(channelUuid) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM broadcasts 
      WHERE channel_uuid = ?
    `;
    const result = await fetchOne(sql, [channelUuid]);
    return result.total;
  }

  /**
   * Count total broadcasts for account (legacy)
   * @deprecated Use countByChannel instead
   */
  static async countByAccount(accountId) {
    console.warn('⚠️ Broadcast.countByAccount() is deprecated. Use countByChannel() instead.');
    return 0;
  }

  /**
   * Get all broadcasts
   */
  static async getAllBroadcasts(limit = 50, offset = 0) {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        p.project_name,
        u.user_username,
        v.video_title,
        v.thumbnail_path as video_thumbnail,
        pl.playlist_name
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN projects p ON ch.project_uuid = p.project_uuid
      LEFT JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid AND b.broadcast_type = 'single'
      LEFT JOIN playlists pl ON b.channel_uuid = pl.channel_uuid AND b.broadcast_type = 'playlist'
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [limit, offset]);
  }

  /**
   * Get active broadcasts
   */
  static async getActiveBroadcasts() {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        v.video_filepath,
        p.project_name,
        u.user_username
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN projects p ON ch.project_uuid = p.project_uuid
      LEFT JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid
      WHERE b.broadcast_status = 'active'
      ORDER BY b.started_at DESC
    `;
    return await fetchAll(sql);
  }

  /**
   * Get scheduled broadcasts
   */
  static async getScheduledBroadcasts() {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        v.video_title,
        v.thumbnail_path as video_thumbnail,
        pl.playlist_name,
        pl.playback_mode,
        p.project_name,
        u.user_username
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN projects p ON ch.project_uuid = p.project_uuid
      LEFT JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid AND b.broadcast_type = 'single'
      LEFT JOIN playlists pl ON b.channel_uuid = pl.channel_uuid AND b.broadcast_type = 'playlist'
      WHERE b.broadcast_status = 'scheduled'
      AND b.scheduled_time IS NOT NULL
      ORDER BY b.scheduled_time ASC
    `;
    return await fetchAll(sql);
  }

  /**
   * Update broadcast status
   */
  static async updateStatus(broadcastId, status, errorMessage = null) {
    const { getCurrentTimestamp } = require('../utils/datetime');
    const currentTime = getCurrentTimestamp();
    
    let sql = 'UPDATE broadcasts SET broadcast_status = ?';
    const params = [status];

    if (status === 'active' && !errorMessage) {
      sql += ', started_at = ?';
      params.push(currentTime);
    } else if (status === 'completed' || status === 'failed') {
      sql += ', ended_at = ?';
      params.push(currentTime);
    }

    if (errorMessage) {
      sql += ', error_message = ?';
      params.push(errorMessage);
    }

    sql += ' WHERE broadcast_id = ?';
    params.push(broadcastId);

    return await executeQuery(sql, params);
  }

  /**
   * Delete broadcast
   */
  static async deleteBroadcast(broadcastId) {
    const sql = 'DELETE FROM broadcasts WHERE broadcast_id = ?';
    return await executeQuery(sql, [broadcastId]);
  }

  /**
   * Get broadcast count by status
   */
  static async getCountByStatus(channelUuid, status) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM broadcasts 
      WHERE channel_uuid = ? AND broadcast_status = ?
    `;
    const result = await fetchOne(sql, [channelUuid, status]);
    return result.total;
  }

  /**
   * Get broadcasts by platform
   */
  static async getByPlatform(platformName, limit = 50) {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        u.user_username,
        v.video_title
      FROM broadcasts b
      LEFT JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      LEFT JOIN projects p ON ch.project_uuid = p.project_uuid
      LEFT JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid
      WHERE b.platform_name = ?
      ORDER BY b.created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [platformName, limit]);
  }

  /**
   * Update broadcast destination
   */
  static async updateDestination(broadcastId, destinationUrl, streamKey) {
    const sql = `
      UPDATE broadcasts 
      SET destination_url = ?, stream_key = ?, updated_at = ?
      WHERE broadcast_id = ?
    `;
    return await executeQuery(sql, [destinationUrl, streamKey, formatForDb(new Date()), broadcastId]);
  }

  /**
   * Fix active broadcasts with NULL started_at
   */
  static async fixActiveStartedAt() {
    const sql = `
      UPDATE broadcasts 
      SET started_at = created_at
      WHERE broadcast_status = 'active' 
      AND started_at IS NULL
    `;
    const result = await executeQuery(sql);
    if (result && result.changes > 0) {
      console.log(`✓ Fixed ${result.changes} active broadcast(s) with NULL started_at`);
    }
    return result;
  }

  /**
   * Cleanup orphaned active broadcasts on server restart
   * Sets all 'active' broadcasts to 'failed' since their FFmpeg processes are lost
   */
  static async cleanupOrphanedBroadcasts() {
    const { getCurrentTimestamp } = require('../utils/datetime');
    const currentTime = getCurrentTimestamp();
    
    const sql = `
      UPDATE broadcasts 
      SET broadcast_status = 'failed',
          error_message = 'Server restarted while broadcast was active',
          ended_at = ?,
          updated_at = ?
      WHERE broadcast_status = 'active'
    `;
    const result = await executeQuery(sql, [currentTime, currentTime]);
    if (result && result.changes > 0) {
      console.log(`✓ Cleaned up ${result.changes} orphaned broadcast(s) from previous session`);
    }
    return result;
  }

  /**
   * Update broadcast with video/playlist
   */
  static async updateBroadcastContent(broadcastId, videoUuid, broadcastType = 'single') {
    const sql = `
      UPDATE broadcasts 
      SET video_uuid = ?, broadcast_type = ?, updated_at = ?
      WHERE broadcast_id = ?
    `;
    return await executeQuery(sql, [videoUuid, broadcastType, formatForDb(new Date()), broadcastId]);
  }

  /**
   * Get broadcasts for user's channels
   */
  static async getByUserUuid(userUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT 
        b.*,
        ch.channel_name,
        ch.channel_platform,
        p.project_name,
        v.video_title,
        v.thumbnail_path as video_thumbnail
      FROM broadcasts b
      INNER JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      INNER JOIN projects p ON ch.project_uuid = p.project_uuid
      INNER JOIN users u ON p.user_uuid = u.user_uuid
      LEFT JOIN videos v ON b.video_uuid = v.video_uuid
      WHERE u.user_uuid = ?
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [userUuid, limit, offset]);
  }

  /**
   * Count broadcasts for user
   */
  static async countByUserUuid(userUuid) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM broadcasts b
      INNER JOIN channels ch ON b.channel_uuid = ch.channel_uuid
      INNER JOIN projects p ON ch.project_uuid = p.project_uuid
      INNER JOIN users u ON p.user_uuid = u.user_uuid
      WHERE u.user_uuid = ?
    `;
    const result = await fetchOne(sql, [userUuid]);
    return result.total;
  }
}

module.exports = Broadcast;
