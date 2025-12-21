const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * StreamKey Model - Manages RTMP stream keys per channel
 * Stream keys are credentials used for broadcasting to external platforms
 * 
 * Schema:
 * - streamkey_id (PK): ID (UUID format)
 * - streamkey_uuid (unique): UUID for external references
 * - channel_uuid: FK to channels table
 * - streamkey_name: Name/label for this key
 * - streamkey_description: Description
 * - server_url: RTMP server endpoint
 * - stream_key: Actual stream key value
 * - is_active: Whether this key is currently in use
 * - created_at, updated_at: Timestamps
 */
class StreamKey {
  /**
   * Create a new stream key
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {string} keyName - Name for this key
   * @param {string} serverUrl - RTMP server URL
   * @param {string} streamKey - Stream key value
   * @param {string} description - Description (optional)
   * @param {Object} options - Additional options (streamingProtocol, enableManualSettings, enable60fps)
   * @returns {Promise<Object>} { streamKeyId, streamKeyUuid }
   */
  static async createNew(channelUuid, keyName, serverUrl, streamKey, description = null, options = {}) {
    const streamKeyId = uuidv4();
    const streamKeyUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO streamkeys (
        streamkey_id, streamkey_uuid, channel_uuid, streamkey_name,
        streamkey_description, server_url, stream_key,
        streaming_protocol, enable_manual_settings, manual_resolution, enable_60fps,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      streamKeyId,
      streamKeyUuid,
      channelUuid,
      keyName,
      description,
      serverUrl,
      streamKey,
      options.streamingProtocol || 'rtmp',
      options.enableManualSettings || false,
      options.manualResolution || '1080p',
      options.enable60fps || false,
      now,
      now
    ]);

    console.log(`✓ Stream key created: ${keyName}`);
    return { streamKeyId, streamKeyUuid };
  }

  /**
   * Find stream key by ID
   * 
   * @param {string} streamKeyId - Stream key ID
   * @returns {Promise<Object|null>} Stream key object
   */
  static async findById(streamKeyId) {
    const sql = `
      SELECT sk.*, c.channel_name, p.project_name
      FROM streamkeys sk
      LEFT JOIN channels c ON sk.channel_uuid = c.channel_uuid
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE sk.streamkey_id = ?
    `;
    return await fetchOne(sql, [streamKeyId]);
  }

  /**
   * Find stream key by UUID
   * 
   * @param {string} streamKeyUuid - Stream key UUID
   * @returns {Promise<Object|null>} Stream key object
   */
  static async findByUuid(streamKeyUuid) {
    const sql = `
      SELECT sk.*, c.channel_name, p.project_name
      FROM streamkeys sk
      LEFT JOIN channels c ON sk.channel_uuid = c.channel_uuid
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE sk.streamkey_uuid = ?
    `;
    return await fetchOne(sql, [streamKeyUuid]);
  }

  /**
   * Get all stream keys for a channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of stream keys
   */
  static async getByChannel(channelUuid, limit = 50) {
    const sql = `
      SELECT * FROM streamkeys
      WHERE channel_uuid = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [channelUuid, limit]);
  }

  /**
   * Get active stream key for channel (only one should be active)
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<Object|null>} Active stream key or null
   */
  static async getActiveByChannel(channelUuid) {
    const sql = `
      SELECT * FROM streamkeys
      WHERE channel_uuid = ? AND is_active = 1
      LIMIT 1
    `;
    return await fetchOne(sql, [channelUuid]);
  }

  /**
   * Get stream key count for channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<number>} Stream key count
   */
  static async getCountByChannel(channelUuid) {
    const sql = 'SELECT COUNT(*) as total FROM streamkeys WHERE channel_uuid = ?';
    const result = await fetchOne(sql, [channelUuid]);
    return result?.total || 0;
  }

  /**
   * Update stream key details
   * 
   * @param {string} streamKeyId - Stream key ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateDetails(streamKeyId, updates) {
    const allowedFields = [
      'streamkey_name',
      'streamkey_description',
      'server_url',
      'stream_key',
      'streaming_protocol',
      'enable_manual_settings',
      'manual_resolution',
      'enable_60fps'
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
    values.push(streamKeyId);

    const sql = `UPDATE streamkeys SET ${fields.join(', ')} WHERE streamkey_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Set stream key as active (deactivate others in same channel)
   * 
   * @param {string} streamKeyId - Stream key ID to activate
   * @returns {Promise<Object>} Query result
   */
  static async setActive(streamKeyId) {
    const streamKey = await this.findById(streamKeyId);
    if (!streamKey) throw new Error('Stream key not found');

    // Deactivate all other keys for this channel
    await executeQuery(
      'UPDATE streamkeys SET is_active = 0 WHERE channel_uuid = ?',
      [streamKey.channel_uuid]
    );

    // Activate this key
    const sql = 'UPDATE streamkeys SET is_active = 1, updated_at = ? WHERE streamkey_id = ?';
    return await executeQuery(sql, [getCurrentTimestamp(), streamKeyId]);
  }

  /**
   * Delete stream key
   * 
   * @param {string} streamKeyId - Stream key ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteStreamKey(streamKeyId) {
    const sql = 'DELETE FROM streamkeys WHERE streamkey_id = ?';
    return await executeQuery(sql, [streamKeyId]);
  }

  /**
   * Deactivate stream key
   * 
   * @param {string} streamKeyId - Stream key ID
   * @returns {Promise<Object>} Query result
   */
  static async deactivate(streamKeyId) {
    const sql = 'UPDATE streamkeys SET is_active = 0, updated_at = ? WHERE streamkey_id = ?';
    return await executeQuery(sql, [getCurrentTimestamp(), streamKeyId]);
  }

  /**
   * Check if stream key exists and is valid
   * 
   * @param {string} streamKeyValue - Stream key value to check
   * @returns {Promise<Object|null>} Stream key if valid
   */
  static async findByValue(streamKeyValue) {
    const sql = 'SELECT * FROM streamkeys WHERE stream_key = ?';
    return await fetchOne(sql, [streamKeyValue]);
  }
}

module.exports = StreamKey;
