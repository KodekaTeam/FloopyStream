const { executeQuery, fetchOne, fetchAll } = require("../core/database");
const { v4: uuidv4 } = require("uuid");
const { formatForDb } = require("../utils/datetime");

/**
 * Broadcast Model - manages live broadcasts/streams
 */
class Broadcast {
  /**
   * Create new broadcast
   */
  static async createNew(accountId, broadcastData) {
    const broadcastUuid = uuidv4();

    const broadcastName = broadcastData.broadcastName || "Untitled Broadcast";

    // Determine initial status: 'scheduled' if scheduledTime provided, otherwise 'offline'
    const initialStatus = broadcastData.scheduledTime ? "scheduled" : "offline";

    console.log("Broadcast.createNew called with:", {
      accountId,
      contentId: broadcastData.contentId,
      platformName: broadcastData.platformName,
      broadcastName: broadcastName,
      status: initialStatus,
      bitrate: broadcastData.bitrate,
      frameRate: broadcastData.frameRate,
      resolution: broadcastData.resolution,
      orientation: broadcastData.orientation,
      advancedSettings: broadcastData.advancedSettings,
      loopvideo: broadcastData.loopvideo,
      durationTimeout: broadcastData.durationTimeout,
    });

    const sql = `
      INSERT INTO broadcasts (
        broadcast_uuid, account_id, content_id, content_type, platform_name,
        destination_url, stream_key, scheduled_time, broadcast_name, broadcast_status,
        bitrate, frame_rate, resolution, orientation, advanced_settings, loopvideo, duration_timeout, created_at, updated_at, started_at, ended_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      broadcastUuid,
      accountId,
      broadcastData.contentId || null,
      broadcastData.contentType || "content",
      broadcastData.platformName,
      broadcastData.destinationUrl,
      broadcastData.streamKey || null,
      broadcastData.scheduledTime
        ? formatForDb(broadcastData.scheduledTime)
        : null,
      broadcastName,
      initialStatus,
      broadcastData.bitrate || null,
      broadcastData.frameRate || null,
      broadcastData.resolution || null,
      broadcastData.orientation || null,
      broadcastData.advancedSettings
        ? JSON.stringify(broadcastData.advancedSettings)
        : null,
      broadcastData.loopvideo !== undefined
        ? broadcastData.loopvideo
          ? 1
          : 0
        : 1,
      broadcastData.durationTimeout || null,
      formatForDb(new Date()),
      formatForDb(new Date()),
      formatForDb(new Date()),
      formatForDb(new Date()),
    ];

    const result = await executeQuery(sql, params);

    console.log(
      "Broadcast created with ID:",
      result.lastID,
      "Name:",
      broadcastName,
      "Status:",
      initialStatus
    );

    return { broadcastId: result.lastID, broadcastUuid };
  }

  /**
   * Find broadcast by ID
   */
  static async findById(broadcastId) {
    const sql = `
      SELECT b.*, a.username, a.display_name, c.title as content_title, c.thumbnail_path
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id
      WHERE b.broadcast_id = ?
    `;
    return await fetchOne(sql, [broadcastId]);
  }

  /**
   * Find broadcast by UUID
   */
  static async findByUuid(broadcastUuid) {
    const sql = `
      SELECT b.*, a.username, a.display_name, c.title as content_title, c.thumbnail_path
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id
      WHERE b.broadcast_uuid = ?
    `;
    return await fetchOne(sql, [broadcastUuid]);
  }

  /**
   * Get broadcasts by account
   */
  static async getByAccount(accountId, limit = 50, offset = 0) {
    const sql = `
      SELECT 
        b.*,
        CASE 
          WHEN b.content_type = 'playlist' THEN p.playlist_name
          ELSE c.title
        END as content_title,
        CASE 
          WHEN b.content_type = 'playlist' THEN (
            SELECT ct.thumbnail_path 
            FROM playlist_items pi 
            JOIN content ct ON pi.content_id = ct.content_id 
            WHERE pi.playlist_id = b.content_id 
            ORDER BY pi.order_index ASC 
            LIMIT 1
          )
          ELSE c.thumbnail_path
        END as thumbnail_path,
        p.playlist_name,
        p.playback_mode
      FROM broadcasts b
      LEFT JOIN content c ON b.content_id = c.content_id AND b.content_type = 'content'
      LEFT JOIN playlists p ON b.content_id = p.playlist_id AND b.content_type = 'playlist'
      WHERE b.account_id = ?
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [accountId, limit, offset]);
  }

  /**
   * Get broadcasts by account with pagination (alias for getByAccount)
   */
  static async getByAccountWithPagination(accountId, limit = 10, offset = 0) {
    return await this.getByAccount(accountId, limit, offset);
  }

  /**
   * Count total broadcasts for an account
   */
  static async countByAccount(accountId) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM broadcasts 
      WHERE account_id = ?
    `;
    const result = await fetchOne(sql, [accountId]);
    return result.total;
  }

  /**
   * Get all broadcasts
   */
  static async getAllBroadcasts(limit = 50, offset = 0) {
    const sql = `
      SELECT 
        b.*, 
        a.username, 
        a.display_name,
        CASE 
          WHEN b.content_type = 'playlist' THEN p.playlist_name
          ELSE c.title
        END as content_title,
        CASE 
          WHEN b.content_type = 'playlist' THEN (
            SELECT ct.thumbnail_path 
            FROM playlist_items pi 
            JOIN content ct ON pi.content_id = ct.content_id 
            WHERE pi.playlist_id = b.content_id 
            ORDER BY pi.order_index ASC 
            LIMIT 1
          )
          ELSE c.thumbnail_path
        END as thumbnail_path,
        p.playlist_name,
        p.playback_mode
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id AND b.content_type = 'content'
      LEFT JOIN playlists p ON b.content_id = p.playlist_id AND b.content_type = 'playlist'
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
      SELECT b.*, a.username, c.title as content_title, c.filepath
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id
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
        a.username,
        CASE 
          WHEN b.content_type = 'playlist' THEN p.playlist_name
          ELSE c.title
        END as content_title,
        p.playlist_name,
        p.playback_mode
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id AND b.content_type = 'content'
      LEFT JOIN playlists p ON b.content_id = p.playlist_id AND b.content_type = 'playlist'
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
    const { getCurrentTimestamp } = require("../utils/datetime");
    const currentTime = getCurrentTimestamp();

    let sql = "UPDATE broadcasts SET broadcast_status = ?";
    const params = [status];

    if (status === "active" && !errorMessage) {
      sql += ", started_at = ?";
      params.push(currentTime);
    } else if (status === "completed" || status === "failed") {
      sql += ", ended_at = ?";
      params.push(currentTime);
    }

    if (errorMessage) {
      sql += ", error_message = ?";
      params.push(errorMessage);
    }

    sql += " WHERE broadcast_id = ?";
    params.push(broadcastId);

    return await executeQuery(sql, params);
  }

  /**
   * Delete broadcast
   */
  static async deleteBroadcast(broadcastId) {
    const sql = "DELETE FROM broadcasts WHERE broadcast_id = ?";
    return await executeQuery(sql, [broadcastId]);
  }

  /**
   * Get broadcast count by status
   */
  static async getCountByStatus(accountId, status) {
    const sql = `
      SELECT COUNT(*) as total 
      FROM broadcasts 
      WHERE account_id = ? AND broadcast_status = ?
    `;
    const result = await fetchOne(sql, [accountId, status]);
    return result.total;
  }

  /**
   * Get broadcasts by platform
   */
  static async getByPlatform(platformName, limit = 50) {
    const sql = `
      SELECT b.*, a.username, c.title as content_title
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id
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
      SET destination_url = ?, stream_key = ?
      WHERE broadcast_id = ?
    `;
    return await executeQuery(sql, [destinationUrl, streamKey, broadcastId]);
  }

  /**
   * Fix active broadcasts with NULL started_at
   * This is a migration helper to fix broadcasts created before started_at was implemented
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
      console.log(
        `✓ Fixed ${result.changes} active broadcast(s) with NULL started_at`
      );
    }
    return result;
  }

  /**
   * Cleanup orphaned active broadcasts on server restart
   * Sets all 'active' broadcasts to 'failed' since their FFmpeg processes are lost
   */
  static async cleanupOrphanedBroadcasts() {
    const { getCurrentTimestamp } = require("../utils/datetime");
    const currentTime = getCurrentTimestamp();

    const sql = `
      UPDATE broadcasts 
      SET broadcast_status = 'failed',
          error_message = 'Server restarted while broadcast was active',
          ended_at = ?
      WHERE broadcast_status = 'active'
    `;
    const result = await executeQuery(sql, [currentTime]);
    if (result && result.changes > 0) {
      console.log(
        `✓ Cleaned up ${result.changes} orphaned broadcast(s) from previous session`
      );
    }
    return result;
  }

  /**
   * Get broadcast with content type detection
   * Detects if content_id refers to a playlist or regular content
   */
  static async getBroadcastWithContentType(broadcastId) {
    const sql = `
      SELECT 
        b.*,
        a.username,
        a.display_name,
        c.title as content_title,
        c.filepath as content_filepath,
        c.thumbnail_path,
        c.duration_seconds,
        p.playlist_name,
        CASE 
          WHEN p.playlist_id IS NOT NULL THEN 'playlist'
          WHEN c.content_id IS NOT NULL THEN 'content'
          ELSE NULL
        END AS content_type
      FROM broadcasts b
      LEFT JOIN accounts a ON b.account_id = a.account_id
      LEFT JOIN content c ON b.content_id = c.content_id
      LEFT JOIN playlists p ON b.content_id = p.playlist_id
      WHERE b.broadcast_id = ?
    `;
    return await fetchOne(sql, [broadcastId]);
  }
}

module.exports = Broadcast;
