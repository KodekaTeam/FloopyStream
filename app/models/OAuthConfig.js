const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * OAuthConfig Model - Manages OAuth configuration for users
 *
 * Schema:
 * - oauth_config_id (PK): Unique identifier
 * - user_uuid: Reference to user
 * - google_client_id: Google OAuth client ID
 * - google_client_secret: Google OAuth client secret
 * - google_redirect_uri: Google OAuth redirect URI
 * - created_at, updated_at: Timestamps
 */
class OAuthConfig {
  /**
   * Get OAuth config for a user
   * @param {string} userUuid - User's UUID
   * @returns {Promise<Object|null>} OAuth config or null
   */
  static async getByUserUuid(userUuid) {
    const sql = `
      SELECT * FROM oauth_config
      WHERE user_uuid = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return await fetchOne(sql, [userUuid]);
  }

  /**
   * Create or update OAuth config for a user
   * @param {string} userUuid - User's UUID
   * @param {string} googleClientId - Google client ID
   * @param {string} googleClientSecret - Google client secret
   * @param {string} googleRedirectUri - Google redirect URI
   * @returns {Promise<number>} OAuth config ID
   */
  static async upsert(userUuid, googleClientId, googleClientSecret, googleRedirectUri) {
    const now = getCurrentTimestamp();
    const existing = await this.getByUserUuid(userUuid);

    if (existing) {
      // Update existing
      const sql = `
        UPDATE oauth_config
        SET google_client_id = ?, google_client_secret = ?, google_redirect_uri = ?, updated_at = ?
        WHERE oauth_config_id = ?
      `;
      await executeQuery(sql, [googleClientId, googleClientSecret, googleRedirectUri, now, existing.oauth_config_id]);
      return existing.oauth_config_id;
    } else {
      // Create new
      const sql = `
        INSERT INTO oauth_config (oauth_config_uuid, user_uuid, google_client_id, google_client_secret, google_redirect_uri, oauth_token_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const result = await executeQuery(sql, [uuidv4(), userUuid, googleClientId, googleClientSecret, googleRedirectUri, 'google', now, now]);
      return result.lastID;
    }
  }

  /**
   * Delete OAuth config for a user
   * @param {string} userUuid - User's UUID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteByUserUuid(userUuid) {
    const sql = `DELETE FROM oauth_config WHERE user_uuid = ?`;
    const result = await executeQuery(sql, [userUuid]);
    return result.changes > 0;
  }
}

module.exports = OAuthConfig;