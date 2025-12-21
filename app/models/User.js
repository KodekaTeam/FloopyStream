const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * User Model - Manages user accounts
 * Replaces old Account model with new users table structure
 * 
 * Schema:
 * - user_id (PK): Unique identifier
 * - user_uuid (unique): UUID for external references
 * - user_fullname: Full name of the user
 * - user_username: Unique username
 * - user_email: Unique email for login
 * - user_password: Bcrypt hashed password
 * - profile_picture: Optional profile image URL
 * - user_role: enum('admin', 'member')
 * - is_active: Active status
 * - created_at, updated_at: Timestamps
 */
class User {
  /**
   * Create a new user account
   * First user created is automatically an admin
   * 
   * @param {string} fullname - User's full name
   * @param {string} username - Unique username
   * @param {string} email - Unique email address
   * @param {string} password - Plain password (will be hashed)
   * @returns {Promise<number>} User ID
   */
  static async createNew(fullname, username, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const userUuid = uuidv4();
    const now = getCurrentTimestamp();

    // Check if this is the first user - make them admin
    const count = await this.getUserCount();
    const role = count === 0 ? 'admin' : 'member';

    const sql = `
      INSERT INTO users (
        user_uuid, user_fullname, user_username, user_email, user_password,
        user_role, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      userUuid,
      fullname,
      username,
      email,
      passwordHash,
      role,
      1,
      now,
      now
    ]);

    console.log(`✓ User created: ${username} (ID: ${result.lastID})`);
    return result.lastID;
  }

  /**
   * Find user by username
   * 
   * @param {string} username - Username to search
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE user_username = ?';
    return await fetchOne(sql, [username]);
  }

  /**
   * Find user by email
   * 
   * @param {string} email - Email to search
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE user_email = ?';
    return await fetchOne(sql, [email]);
  }

  /**
   * Find user by user ID
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(userId) {
    const sql = 'SELECT * FROM users WHERE user_id = ?';
    return await fetchOne(sql, [userId]);
  }

  /**
   * Find user by UUID
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByUuid(userUuid) {
    const sql = 'SELECT * FROM users WHERE user_uuid = ?';
    return await fetchOne(sql, [userUuid]);
  }

  /**
   * Verify password against hash
   * 
   * @param {string} password - Plain password
   * @param {string} passwordHash - Hashed password from database
   * @returns {Promise<boolean>} True if password matches
   */
  static async verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
  }

  /**
   * Update user profile information
   * 
   * @param {number} userId - User ID
   * @param {Object} updates - Fields to update (user_fullname, user_email, profile_picture)
   * @returns {Promise<Object>} Query result
   */
  static async updateProfile(userId, updates) {
    const allowedFields = ['user_fullname', 'user_email', 'profile_picture'];
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
    values.push(userId);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Update user password
   * 
   * @param {number} userId - User ID
   * @param {string} newPassword - New plain password
   * @returns {Promise<Object>} Query result
   */
  static async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const sql = `
      UPDATE users 
      SET user_password = ?, updated_at = ? 
      WHERE user_id = ?
    `;
    return await executeQuery(sql, [passwordHash, getCurrentTimestamp(), userId]);
  }

  /**
   * Get all users (admin view)
   * 
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of users
   */
  static async getAllUsers(limit = 50, offset = 0) {
    const sql = `
      SELECT user_id, user_uuid, user_fullname, user_username, user_email,
             profile_picture, user_role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [limit, offset]);
  }

  /**
   * Delete user
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteUser(userId) {
    const sql = 'DELETE FROM users WHERE user_id = ?';
    return await executeQuery(sql, [userId]);
  }

  /**
   * Toggle user active status
   * 
   * @param {number} userId - User ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>} Query result
   */
  static async toggleStatus(userId, isActive) {
    const sql = 'UPDATE users SET is_active = ?, updated_at = ? WHERE user_id = ?';
    return await executeQuery(sql, [isActive ? 1 : 0, getCurrentTimestamp(), userId]);
  }

  /**
   * Update user role
   * 
   * @param {number} userId - User ID
   * @param {string} role - Role ('admin' or 'member')
   * @returns {Promise<Object>} Query result
   */
  static async updateRole(userId, role) {
    const validRoles = ['admin', 'member'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be admin or member');
    }
    const sql = 'UPDATE users SET user_role = ?, updated_at = ? WHERE user_id = ?';
    return await executeQuery(sql, [role, getCurrentTimestamp(), userId]);
  }

  /**
   * Get total user count
   * 
   * @returns {Promise<number>} Number of users
   */
  static async getUserCount() {
    const sql = 'SELECT COUNT(*) as count FROM users';
    const result = await fetchOne(sql);
    return result?.count || 0;
  }

  /**
   * Get user statistics
   * 
   * @returns {Promise<Object>} Stats including total, active, inactive, admins, members
   */
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN user_role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN user_role = 'member' THEN 1 ELSE 0 END) as members
      FROM users
    `;
    return await fetchOne(sql);
  }

  /**
   * Search users by username or email
   * 
   * @param {string} searchTerm - Search term
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of matching users
   */
  static async search(searchTerm, limit = 50) {
    const sql = `
      SELECT user_id, user_uuid, user_fullname, user_username, user_email,
             profile_picture, user_role, is_active, created_at, updated_at
      FROM users
      WHERE user_username LIKE ? OR user_email LIKE ? OR user_fullname LIKE ?
      ORDER BY user_username ASC
      LIMIT ?
    `;
    const term = `%${searchTerm}%`;
    return await fetchAll(sql, [term, term, term, limit]);
  }

  /**
   * Check if username exists
   * 
   * @param {string} username - Username to check
   * @returns {Promise<boolean>} True if exists
   */
  static async usernameExists(username) {
    const sql = 'SELECT COUNT(*) as count FROM users WHERE user_username = ?';
    const result = await fetchOne(sql, [username]);
    return (result?.count || 0) > 0;
  }

  /**
   * Check if email exists
   * 
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if exists
   */
  static async emailExists(email) {
    const sql = 'SELECT COUNT(*) as count FROM users WHERE user_email = ?';
    const result = await fetchOne(sql, [email]);
    return (result?.count || 0) > 0;
  }

  /**
   * Check if any admin user exists
   * 
   * @returns {Promise<boolean>} True if at least one admin exists
   */
  static async hasAdminUser() {
    const sql = 'SELECT COUNT(*) as count FROM users WHERE user_role = "admin"';
    const result = await fetchOne(sql);
    return (result?.count || 0) > 0;
  }
}

module.exports = User;
