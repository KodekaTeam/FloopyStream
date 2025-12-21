/**
 * User Adapter - Simplified for User model only
 * Provides compatibility layer for sessions and legacy code
 */

const User = require('../models/User');

class UserAdapter {
  /**
   * Get user by ID
   */
  static async findById(id) {
    const user = await User.findById(id);
    if (user) {
      return {
        ...user,
        account_id: user.user_id,
        account_uuid: user.user_uuid,
        username: user.user_username,
        email: user.user_email,
        password_hash: user.user_password,
        display_name: user.user_fullname,
        account_role: user.user_role
      };
    }
    return null;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    const user = await User.findByUsername(username);
    if (user) {
      return {
        ...user,
        account_id: user.user_id,
        account_uuid: user.user_uuid,
        username: user.user_username,
        email: user.user_email,
        password_hash: user.user_password,
        display_name: user.user_fullname,
        account_role: user.user_role
      };
    }
    return null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const user = await User.findByEmail(email);
    if (user) {
      return {
        ...user,
        account_id: user.user_id,
        account_uuid: user.user_uuid,
        username: user.user_username,
        email: user.user_email,
        password_hash: user.user_password,
        display_name: user.user_fullname,
        account_role: user.user_role
      };
    }
    return null;
  }

  /**
   * Verify password
   */
  static async verifyPassword(password, hash) {
    return await User.verifyPassword(password, hash);
  }

  /**
   * Create new user
   */
  static async createNew(username, email, password, displayName = null) {
    return await User.createNew(
      displayName || username,
      username,
      email,
      password
    );
  }

  /**
   * Get all users
   */
  static async getAllUsers(limit = 50, offset = 0) {
    const users = await User.getAllUsers(limit, offset);
    return users.map(user => ({
      ...user,
      account_id: user.user_id,
      account_uuid: user.user_uuid,
      username: user.user_username,
      email: user.user_email,
      password_hash: user.user_password,
      display_name: user.user_fullname,
      account_role: user.user_role
    }));
  }

  /**
   * Update profile
   */
  static async updateProfile(id, updates) {
    const mappedUpdates = {};
    if (updates.display_name) mappedUpdates.user_fullname = updates.display_name;
    if (updates.email) mappedUpdates.user_email = updates.email;
    if (updates.profile_picture) mappedUpdates.profile_picture = updates.profile_picture;
    return await User.updateProfile(id, mappedUpdates);
  }

  /**
   * Update password
   */
  static async updatePassword(id, newPassword) {
    return await User.updatePassword(id, newPassword);
  }

  /**
   * Update role
   */
  static async updateRole(id, role) {
    return await User.updateRole(id, role);
  }

  /**
   * Toggle user status
   */
  static async toggleStatus(id, isActive) {
    return await User.toggleStatus(id, isActive);
  }

  /**
   * Delete user
   */
  static async deleteUser(id) {
    return await User.deleteUser(id);
  }

  /**
   * Get user statistics
   */
  static async getStats() {
    return await User.getStats();
  }

  /**
   * Get user count
   */
  static async getUserCount() {
    return await User.getUserCount();
  }

  /**
   * Check if any admin user exists
   */
  static async hasAdminUser() {
    return await User.hasAdminUser();
  }
}

module.exports = UserAdapter;
