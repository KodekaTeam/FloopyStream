const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * GoogleDriveToken Model - Manages Google Drive OAuth tokens
 * 
 * Schema:
 * - token_id (PK): Unique identifier
 * - token_uuid (unique): UUID for external references
 * - user_uuid (unique, FK): Reference to user
 * - access_token: Google OAuth access token
 * - refresh_token: Google OAuth refresh token
 * - expires_at: Token expiration timestamp
 * - created_at, updated_at: Timestamps
 * 
 * Constraints:
 * - One user can have only one Google Drive token
 * - If user is deleted, token is automatically deleted (CASCADE)
 */
class GoogleDriveToken {
  /**
   * Create new Google Drive token for a user
   * 
   * @param {string} userUuid - User UUID
   * @param {string} accessToken - Google OAuth access token
   * @param {string} refreshToken - Google OAuth refresh token
   * @param {string} expiresAt - Token expiration timestamp
   * @returns {Promise<Object>} Created token record
   */
  static async createToken(userUuid, accessToken, refreshToken, expiresAt) {
    const tokenUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO google_drive_tokens (
        token_uuid, user_uuid, access_token, refresh_token, expires_at,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_uuid) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `;

    const result = await executeQuery(sql, [
      tokenUuid,
      userUuid,
      accessToken,
      refreshToken,
      expiresAt,
      now,
      now
    ]);

    console.log(`✓ Google Drive token saved for user: ${userUuid}`);
    return result;
  }

  /**
   * Get token by user UUID
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<Object|null>} Token record or null
   */
  static async getByUserUuid(userUuid) {
    const sql = 'SELECT * FROM google_drive_tokens WHERE user_uuid = ?';
    return await fetchOne(sql, [userUuid]);
  }

  /**
   * Get token by token UUID
   * 
   * @param {string} tokenUuid - Token UUID
   * @returns {Promise<Object|null>} Token record or null
   */
  static async getByTokenUuid(tokenUuid) {
    const sql = 'SELECT * FROM google_drive_tokens WHERE token_uuid = ?';
    return await fetchOne(sql, [tokenUuid]);
  }

  /**
   * Update access token
   * 
   * @param {string} userUuid - User UUID
   * @param {string} accessToken - New access token
   * @param {string} expiresAt - New expiration timestamp
   * @returns {Promise<Object>} Query result
   */
  static async updateAccessToken(userUuid, accessToken, expiresAt) {
    const sql = `
      UPDATE google_drive_tokens
      SET access_token = ?, expires_at = ?, updated_at = ?
      WHERE user_uuid = ?
    `;
    return await executeQuery(sql, [
      accessToken,
      expiresAt,
      getCurrentTimestamp(),
      userUuid
    ]);
  }

  /**
   * Check if token is expired
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<boolean>} True if expired or does not exist
   */
  static async isExpired(userUuid) {
    const token = await this.getByUserUuid(userUuid);
    if (!token) return true;

    const expiryTime = new Date(token.expires_at).getTime();
    const currentTime = Date.now();
    // Consider expired if less than 5 minutes remaining
    return expiryTime - currentTime < 5 * 60 * 1000;
  }

  /**
   * Delete token for user
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<Object>} Query result
   */
  static async deleteToken(userUuid) {
    const sql = 'DELETE FROM google_drive_tokens WHERE user_uuid = ?';
    return await executeQuery(sql, [userUuid]);
  }

  /**
   * Check if user has valid token
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<boolean>} True if user has non-expired token
   */
  static async hasValidToken(userUuid) {
    const token = await this.getByUserUuid(userUuid);
    if (!token) return false;

    return !await this.isExpired(userUuid);
  }

  /**
   * Get all tokens (admin only)
   * 
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of tokens (without sensitive data)
   */
  static async getAllTokens(limit = 50, offset = 0) {
    const sql = `
      SELECT 
        token_id, token_uuid, user_uuid, expires_at, created_at, updated_at
      FROM google_drive_tokens
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [limit, offset]);
  }

  /**
   * Get token count
   * 
   * @returns {Promise<number>} Number of tokens
   */
  static async getTokenCount() {
    const sql = 'SELECT COUNT(*) as count FROM google_drive_tokens';
    const result = await fetchOne(sql);
    return result?.count || 0;
  }

  /**
   * Revoke token
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<Object>} Query result
   */
  static async revokeToken(userUuid) {
    const sql = 'DELETE FROM google_drive_tokens WHERE user_uuid = ?';
    return await executeQuery(sql, [userUuid]);
  }

  /**
   * Get token statistics
   * 
   * @returns {Promise<Object>} Stats including total, active, expired
   */
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN expires_at <= datetime('now') THEN 1 ELSE 0 END) as expired
      FROM google_drive_tokens
    `;
    return await fetchOne(sql);
  }
}

module.exports = GoogleDriveToken;
