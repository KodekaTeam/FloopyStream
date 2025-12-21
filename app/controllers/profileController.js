const UserAdapter = require('../models/UserAdapter');
const { validationResult } = require('express-validator');
const { logInfo, logError } = require('../services/activityLogger');

async function updateProfile(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { body, session } = req;
    const { email, displayName } = body;
    const updates = {};

    if (email) updates.email = email;
    if (displayName) updates.display_name = displayName;

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }

    // Check if email already exists (if changing email)
    if (email) {
      const existingEmail = await UserAdapter.findByEmail(email);
      const currentUserId = session.accountId;
      if (existingEmail && existingEmail.user_id !== currentUserId && existingEmail.account_id !== currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    await UserAdapter.updateProfile(session.accountId, updates);

    await logInfo('Profile updated', {
      accountId: session.accountId,
      username: session.username,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    await logError('Failed to update profile', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

async function changePassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { body, session } = req;
    const { currentPassword, newPassword } = body;

    // Get user account
    const account = await UserAdapter.findById(session.accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Verify current password
    const isValidPassword = await UserAdapter.verifyPassword(currentPassword, account.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    await UserAdapter.updatePassword(session.accountId, newPassword);

    await logInfo('Password changed', {
      accountId: session.accountId,
      username: session.username
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    await logError('Failed to change password', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { updateProfile, changePassword };