const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const bcrypt = require('bcrypt');

/**
 * Account Model - manages user accounts
 */
class Account {
  /**
   * Create a new account
   */
  static async createNew(username, email, password, displayName = null) {
    const passwordHash = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require('uuid');
    
    // Check if this is the first user - make them admin
    const count = await this.getAccountCount();
    const role = count === 0 ? 'admin' : 'member';
    
    const sql = `
      INSERT INTO accounts (account_uuid, username, email, password_hash, display_name, account_role)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(sql, [
      uuidv4(),
      username, 
      email, 
      passwordHash, 
      displayName || username,
      role
    ]);
    return result.lastID;
  }

  /**
   * Find account by username
   */
  static async findByUsername(username) {
    const sql = 'SELECT * FROM accounts WHERE username = ?';
    return await fetchOne(sql, [username]);
  }

  /**
   * Find account by email
   */
  static async findByEmail(email) {
    const sql = 'SELECT * FROM accounts WHERE email = ?';
    return await fetchOne(sql, [email]);
  }

  /**
   * Find account by ID
   */
  static async findById(accountId) {
    const sql = 'SELECT * FROM accounts WHERE account_id = ?';
    return await fetchOne(sql, [accountId]);
  }

  /**
   * Verify password
   */
  static async verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
  }

  /**
   * Update account profile
   */
  static async updateProfile(accountId, updates) {
    const allowedFields = ['display_name', 'profile_picture', 'email'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(accountId);

    const sql = `UPDATE accounts SET ${fields.join(', ')} WHERE account_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Update password
   */
  static async updatePassword(accountId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const sql = `
      UPDATE accounts 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE account_id = ?
    `;
    return await executeQuery(sql, [passwordHash, accountId]);
  }

  /**
   * Get all accounts
   */
  static async getAllAccounts(limit = 50, offset = 0) {
    const sql = `
      SELECT account_id, username, email, display_name, profile_picture, 
             account_role, is_active, created_at, updated_at
      FROM accounts
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [limit, offset]);
  }

  /**
   * Delete account
   */
  static async deleteAccount(accountId) {
    const sql = 'DELETE FROM accounts WHERE account_id = ?';
    return await executeQuery(sql, [accountId]);
  }

  /**
   * Toggle account status
   */
  static async toggleStatus(accountId, isActive) {
    const sql = 'UPDATE accounts SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?';
    return await executeQuery(sql, [isActive ? 1 : 0, accountId]);
  }

  /**
   * Update account role
   */
  static async updateRole(accountId, role) {
    const validRoles = ['admin', 'member'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be admin or member');
    }
    const sql = 'UPDATE accounts SET account_role = ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?';
    return await executeQuery(sql, [role, accountId]);
  }

  /**
   * Get account count
   */
  static async getAccountCount() {
    const sql = 'SELECT COUNT(*) as count FROM accounts';
    const result = await fetchOne(sql);
    return result.count;
  }

  /**
   * Create new account with full details (for admin)
   */
  static async createNewWithRole(username, email, password, displayName, role = 'member', isActive = true) {
    const passwordHash = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require('uuid');
    
    const sql = `
      INSERT INTO accounts (account_uuid, username, email, password_hash, display_name, account_role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(sql, [
      uuidv4(),
      username, 
      email, 
      passwordHash, 
      displayName || username,
      role,
      isActive ? 1 : 0
    ]);
    return result.lastID;
  }

  /**
   * Get account statistics
   */
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN account_role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN account_role = 'member' THEN 1 ELSE 0 END) as members
      FROM accounts
    `;
    return await fetchOne(sql);
  }
}

module.exports = Account;
