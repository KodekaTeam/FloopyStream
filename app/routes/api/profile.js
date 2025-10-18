const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const Account = require('../../models/Account');
const { requireAuth } = require('../../middleware/authGuard');
const { logInfo, logError } = require('../../services/activityLogger');

// ============================================
// UPDATE OWN PROFILE
// ============================================

router.put('/update', requireAuth, [
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('displayName').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const { email, displayName } = req.body;
    const updates = {};

    if (email) updates.email = email;
    if (displayName) updates.display_name = displayName;

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }

    // Check if email already exists (if changing email)
    if (email) {
      const existingEmail = await Account.findByEmail(email);
      if (existingEmail && existingEmail.account_id !== req.session.accountId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already in use' 
        });
      }
    }

    await Account.updateProfile(req.session.accountId, updates);

    await logInfo('Profile updated', {
      accountId: req.session.accountId,
      username: req.session.username,
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
});

// ============================================
// CHANGE OWN PASSWORD
// ============================================

router.put('/change-password', requireAuth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user account
    const account = await Account.findById(req.session.accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Verify current password
    const isValidPassword = await Account.verifyPassword(currentPassword, account.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    await Account.updatePassword(req.session.accountId, newPassword);

    await logInfo('Password changed', {
      accountId: req.session.accountId,
      username: req.session.username
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
});

module.exports = router;
