const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * NotificationChannel Model - Manages notification channels per user
 * Supports multiple notification providers (Telegram, Discord, Email, Slack)
 * 
 * Schema:
 * - notification_id (PK): ID (UUID format)
 * - notification_uuid (unique): UUID for external references
 * - user_uuid: FK to users table
 * - provider: enum('telegram', 'discord', 'email', 'slack')
 * - external_chat_id: Provider-specific chat/channel ID
 * - external_username: Optional provider username
 * - bot_token: Bot API token
 * - is_active: Whether channel is enabled
 * - notify_on_upload: Notify on video upload
 * - notify_on_stream: Notify on stream events
 * - notify_on_error: Notify on errors
 * - notify_on_schedule: Notify on scheduled events
 * - status: Channel status
 * - created_at, updated_at: Timestamps
 */
class NotificationChannel {
  /**
   * Create a new notification channel
   * 
   * @param {string} userUuid - User UUID
   * @param {string} provider - Notification provider
   * @param {Object} channelData - Channel configuration
   * @returns {Promise<Object>} { notificationId, notificationUuid }
   */
  static async createNew(userUuid, provider, channelData) {
    const notificationId = uuidv4();
    const notificationUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO notifications_channels (
        notification_id, notification_uuid, user_uuid, provider,
        external_chat_id, external_username, bot_token, is_active,
        notify_on_upload, notify_on_stream, notify_on_error, notify_on_schedule,
        status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      notificationId,
      notificationUuid,
      userUuid,
      provider,
      channelData.externalChatId || null,
      channelData.externalUsername || null,
      channelData.botToken || null,
      channelData.isActive ? 1 : 0,
      channelData.notifyOnUpload !== false ? 1 : 0,
      channelData.notifyOnStream !== false ? 1 : 0,
      channelData.notifyOnError !== false ? 1 : 0,
      channelData.notifyOnSchedule ? 1 : 0,
      1,
      now,
      now
    ]);

    console.log(`✓ Notification channel created for ${provider}`);
    return { notificationId, notificationUuid };
  }

  /**
   * Find notification channel by ID
   * 
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object|null>} Notification channel object
   */
  static async findById(notificationId) {
    const sql = 'SELECT * FROM notifications_channels WHERE notification_id = ?';
    return await fetchOne(sql, [notificationId]);
  }

  /**
   * Find notification channel by UUID
   * 
   * @param {string} notificationUuid - Notification UUID
   * @returns {Promise<Object|null>} Notification channel object
   */
  static async findByUuid(notificationUuid) {
    const sql = 'SELECT * FROM notifications_channels WHERE notification_uuid = ?';
    return await fetchOne(sql, [notificationUuid]);
  }

  /**
   * Get all notification channels for a user
   * 
   * @param {string} userUuid - User UUID
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of notification channels
   */
  static async getByUser(userUuid, limit = 50) {
    const sql = `
      SELECT * FROM notifications_channels
      WHERE user_uuid = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [userUuid, limit]);
  }

  /**
   * Get notification channels by provider
   * 
   * @param {string} userUuid - User UUID
   * @param {string} provider - Provider name
   * @returns {Promise<Array>} Array of channels
   */
  static async getByProvider(userUuid, provider) {
    const sql = `
      SELECT * FROM notifications_channels
      WHERE user_uuid = ? AND provider = ?
      ORDER BY created_at DESC
    `;
    return await fetchAll(sql, [userUuid, provider]);
  }

  /**
   * Get active notification channels for a user
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<Array>} Array of active channels
   */
  static async getActiveByUser(userUuid) {
    const sql = `
      SELECT * FROM notifications_channels
      WHERE user_uuid = ? AND is_active = 1 AND status = 1
      ORDER BY created_at DESC
    `;
    return await fetchAll(sql, [userUuid]);
  }

  /**
   * Update notification channel settings
   * 
   * @param {string} notificationId - Notification ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateSettings(notificationId, updates) {
    const allowedFields = [
      'bot_token',
      'external_chat_id',
      'external_username',
      'is_active',
      'notify_on_upload',
      'notify_on_stream',
      'notify_on_error',
      'notify_on_schedule',
      'status'
    ];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'bot_token' || key === 'external_chat_id' || key === 'external_username') {
          // String fields
          fields.push(`${key} = ?`);
          values.push(value || null);
        } else {
          // Boolean fields (converted to 0/1)
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        }
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(getCurrentTimestamp());
    values.push(notificationId);

    const sql = `UPDATE notifications_channels SET ${fields.join(', ')} WHERE notification_id = ?`;
    return await executeQuery(sql, values);
  }  /**
   * Toggle notification channel active status
   * 
   * @param {string} notificationId - Notification ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>} Query result
   */
  static async toggleActive(notificationId, isActive) {
    const sql = `
      UPDATE notifications_channels
      SET is_active = ?, updated_at = ?
      WHERE notification_id = ?
    `;
    return await executeQuery(sql, [isActive ? 1 : 0, getCurrentTimestamp(), notificationId]);
  }

  /**
   * Delete notification channel
   * 
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteChannel(notificationId) {
    const sql = 'DELETE FROM notifications_channels WHERE notification_id = ?';
    return await executeQuery(sql, [notificationId]);
  }

  /**
   * Get notification channel count for user
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<number>} Channel count
   */
  static async getCountByUser(userUuid) {
    const sql = 'SELECT COUNT(*) as total FROM notifications_channels WHERE user_uuid = ?';
    const result = await fetchOne(sql, [userUuid]);
    return result?.total || 0;
  }
}

/**
 * NotificationLog Model - Logs notification events
 * Tracks when notifications are sent and their status
 */
class NotificationLog {
  /**
   * Create a notification log entry
   * 
   * @param {string} notificationUuid - Notification channel UUID
   * @param {string} notificationType - Type of notification
   * @param {string} message - Notification message
   * @param {boolean} sent - Whether notification was sent successfully
   * @returns {Promise<Object>} { logId }
   */
  static async createLog(notificationUuid, notificationType, message, sent = true) {
    const logId = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO notifications_logs (
        log_id, notification_uuid, notification_type, message,
        status, sent_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await executeQuery(sql, [
      logId,
      notificationUuid,
      notificationType,
      message,
      sent ? 1 : 0,
      now,
      now
    ]);

    return { logId };
  }

  /**
   * Find notification log by ID
   * 
   * @param {string} logId - Log ID
   * @returns {Promise<Object|null>} Log object
   */
  static async findById(logId) {
    const sql = 'SELECT * FROM notifications_logs WHERE log_id = ?';
    return await fetchOne(sql, [logId]);
  }

  /**
   * Get logs for a notification channel
   * 
   * @param {string} notificationUuid - Notification UUID
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of logs
   */
  static async getByNotification(notificationUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM notifications_logs
      WHERE notification_uuid = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [notificationUuid, limit, offset]);
  }

  /**
   * Get logs by notification type
   * 
   * @param {string} notificationUuid - Notification UUID
   * @param {string} notificationType - Type filter
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of logs
   */
  static async getByType(notificationUuid, notificationType, limit = 50) {
    const sql = `
      SELECT * FROM notifications_logs
      WHERE notification_uuid = ? AND notification_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [notificationUuid, notificationType, limit]);
  }

  /**
   * Get failed logs
   * 
   * @param {string} notificationUuid - Notification UUID
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of failed logs
   */
  static async getFailedLogs(notificationUuid, limit = 50) {
    const sql = `
      SELECT * FROM notifications_logs
      WHERE notification_uuid = ? AND status = 0
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [notificationUuid, limit]);
  }

  /**
   * Get log count for notification
   * 
   * @param {string} notificationUuid - Notification UUID
   * @returns {Promise<number>} Log count
   */
  static async getCountByNotification(notificationUuid) {
    const sql = 'SELECT COUNT(*) as total FROM notifications_logs WHERE notification_uuid = ?';
    const result = await fetchOne(sql, [notificationUuid]);
    return result?.total || 0;
  }

  /**
   * Delete old logs (older than days)
   * 
   * @param {number} daysOld - Delete logs older than this many days
   * @returns {Promise<Object>} Query result
   */
  static async deleteOldLogs(daysOld = 30) {
    const sql = `
      DELETE FROM notifications_logs
      WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')
    `;
    return await executeQuery(sql, [daysOld]);
  }

  /**
   * Get notification statistics
   * 
   * @param {string} notificationUuid - Notification UUID
   * @returns {Promise<Object>} Stats object
   */
  static async getStats(notificationUuid) {
    const sql = `
      SELECT
        COUNT(*) as total_logs,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as failed,
        COUNT(DISTINCT notification_type) as unique_types
      FROM notifications_logs
      WHERE notification_uuid = ?
    `;
    return await fetchOne(sql, [notificationUuid]);
  }
}

module.exports = {
  NotificationChannel,
  NotificationLog
};
