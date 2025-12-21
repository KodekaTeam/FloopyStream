const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * OAuthCredentials Model - Manages OAuth2 credentials per channel
 * Stores OAuth tokens for connecting to external platforms (YouTube, Facebook, etc)
 * 
 * Schema:
 * - oauth_id (PK): Unique identifier
 * - oauth_uuid (unique): UUID for external references
 * - channel_uuid (unique): FK to channels table (1:1 relationship)
 * - provider: enum('google', 'facebook', 'twitch', 'tiktok')
 * - client_id: OAuth client ID
 * - client_secret: OAuth client secret
 * - access_token: Current access token
 * - refresh_token: Refresh token for renewing access
 * - token_type: Token type (usually "Bearer")
 * - expiry_date: When token expires
 * - created_at, updated_at: Timestamps
 */
class OAuthCredentials {
  /**
   * Create OAuth credentials for a channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {string} provider - Provider name
   * @param {Object} tokenData - OAuth token data
   * @param {string} tokenData.accessToken - Access token
   * @param {string} tokenData.refreshToken - Refresh token (optional)
   * @param {string} tokenData.expiryDate - Expiry date
   * @param {string} tokenData.tokenType - Token type (default: 'Bearer')
   * @param {string} tokenData.clientId - Client ID (optional)
   * @param {string} tokenData.clientSecret - Client secret (optional)
   * @returns {Promise<Object>} { oauthId, oauthUuid }
   */
  static async createNew(channelUuid, provider, tokenData) {
    const oauthUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO oauth_credentials (
        oauth_uuid, channel_uuid, provider, client_id, client_secret,
        access_token, refresh_token, token_type, expiry_date,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      oauthUuid,
      channelUuid,
      provider,
      tokenData.clientId || null,
      tokenData.clientSecret || null,
      tokenData.accessToken,
      tokenData.refreshToken || null,
      tokenData.tokenType || 'Bearer',
      tokenData.expiryDate,
      now,
      now
    ]);

    console.log(`✓ OAuth credentials created for ${provider}`);
    return { oauthId: result.lastID, oauthUuid };
  }

  /**
   * Find OAuth credentials by ID
   * 
   * @param {number} oauthId - OAuth ID
   * @returns {Promise<Object|null>} OAuth credentials object
   */
  static async findById(oauthId) {
    const sql = `
      SELECT oa.*, c.channel_name, p.project_name
      FROM oauth_credentials oa
      LEFT JOIN channels c ON oa.channel_uuid = c.channel_uuid
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE oa.oauth_id = ?
    `;
    return await fetchOne(sql, [oauthId]);
  }

  /**
   * Find OAuth credentials by UUID
   * 
   * @param {string} oauthUuid - OAuth UUID
   * @returns {Promise<Object|null>} OAuth credentials object
   */
  static async findByUuid(oauthUuid) {
    const sql = `
      SELECT oa.*, c.channel_name, p.project_name
      FROM oauth_credentials oa
      LEFT JOIN channels c ON oa.channel_uuid = c.channel_uuid
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE oa.oauth_uuid = ?
    `;
    return await fetchOne(sql, [oauthUuid]);
  }

  /**
   * Find OAuth credentials by channel UUID
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<Object|null>} OAuth credentials object
   */
  static async findByChannelUuid(channelUuid) {
    const sql = `
      SELECT oa.*, c.channel_name, p.project_name
      FROM oauth_credentials oa
      LEFT JOIN channels c ON oa.channel_uuid = c.channel_uuid
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE oa.channel_uuid = ?
    `;
    return await fetchOne(sql, [channelUuid]);
  }

  /**
   * Get OAuth credentials by provider
   * 
   * @param {string} provider - Provider name
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of OAuth credentials
   */
  static async getByProvider(provider, limit = 50) {
    const sql = `
      SELECT oa.*, c.channel_name, p.project_name
      FROM oauth_credentials oa
      LEFT JOIN channels c ON oa.channel_uuid = c.channel_uuid
      LEFT JOIN projects p ON c.project_uuid = p.project_uuid
      WHERE oa.provider = ?
      ORDER BY oa.created_at DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [provider, limit]);
  }

  /**
   * Update OAuth tokens
   * 
   * @param {number} oauthId - OAuth ID
   * @param {Object} tokenData - New token data
   * @param {string} tokenData.accessToken - New access token
   * @param {string} tokenData.refreshToken - New refresh token (optional)
   * @param {string} tokenData.expiryDate - New expiry date
   * @returns {Promise<Object>} Query result
   */
  static async updateTokens(oauthId, tokenData) {
    const sql = `
      UPDATE oauth_credentials
      SET access_token = ?, refresh_token = ?, expiry_date = ?, updated_at = ?
      WHERE oauth_id = ?
    `;

    return await executeQuery(sql, [
      tokenData.accessToken,
      tokenData.refreshToken || null,
      tokenData.expiryDate,
      getCurrentTimestamp(),
      oauthId
    ]);
  }

  /**
   * Update OAuth credentials details
   * 
   * @param {number} oauthId - OAuth ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateDetails(oauthId, updates) {
    const allowedFields = ['client_id', 'client_secret', 'token_type'];
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
    values.push(oauthId);

    const sql = `UPDATE oauth_credentials SET ${fields.join(', ')} WHERE oauth_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Check if token is expired
   * 
   * @param {number} oauthId - OAuth ID
   * @returns {Promise<boolean>} True if expired
   */
  static async isTokenExpired(oauthId) {
    const oauth = await this.findById(oauthId);
    if (!oauth || !oauth.expiry_date) return true;

    const expiryTime = new Date(oauth.expiry_date).getTime();
    const currentTime = new Date().getTime();
    return currentTime >= expiryTime;
  }

  /**
   * Delete OAuth credentials
   * 
   * @param {number} oauthId - OAuth ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteOAuth(oauthId) {
    const sql = 'DELETE FROM oauth_credentials WHERE oauth_id = ?';
    return await executeQuery(sql, [oauthId]);
  }

  /**
   * Delete OAuth credentials by channel UUID
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<Object>} Query result
   */
  static async deleteByChannelUuid(channelUuid) {
    const sql = 'DELETE FROM oauth_credentials WHERE channel_uuid = ?';
    return await executeQuery(sql, [channelUuid]);
  }

  /**
   * Check if channel has valid OAuth credentials
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<boolean>} True if has valid credentials
   */
  static async hasValidCredentials(channelUuid) {
    const oauth = await this.findByChannelUuid(channelUuid);
    if (!oauth) return false;

    const isExpired = await this.isTokenExpired(oauth.oauth_id);
    return !isExpired;
  }

  /**
   * Get expiry date in seconds from now
   * 
   * @param {number} oauthId - OAuth ID
   * @returns {Promise<number>} Seconds until expiry (negative if expired)
   */
  static async getTimeUntilExpiry(oauthId) {
    const oauth = await this.findById(oauthId);
    if (!oauth || !oauth.expiry_date) return null;

    const expiryTime = new Date(oauth.expiry_date).getTime();
    const currentTime = new Date().getTime();
    return Math.floor((expiryTime - currentTime) / 1000);
  }
}

module.exports = OAuthCredentials;
