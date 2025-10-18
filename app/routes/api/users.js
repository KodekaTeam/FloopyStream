const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const Account = require('../../models/Account');
const { requireAdmin } = require('../../middleware/authGuard');
const { logInfo, logError } = require('../../services/activityLogger');
const { executeQuery } = require('../../core/database');

// ============================================
// GET ALL USERS (ADMIN ONLY)
// ============================================

router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await Account.getAllAccounts();
    
    // Get content and broadcast counts for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      try {
        // Get video count and total size
        const videoStatsResult = await executeQuery(
          'SELECT COUNT(*) as count, COALESCE(SUM(filesize), 0) as total_size FROM content WHERE account_id = ?',
          [user.account_id]
        );
        const videoStats = videoStatsResult[0] || { count: 0, total_size: 0 };

        // Get broadcast/stream count
        const streamStatsResult = await executeQuery(
          'SELECT COUNT(*) as count, SUM(CASE WHEN broadcast_status = "active" THEN 1 ELSE 0 END) as online FROM broadcasts WHERE account_id = ?',
          [user.account_id]
        );
        const streamStats = streamStatsResult[0] || { count: 0, online: 0 };

        return {
          ...user,
          password_hash: undefined,
          video_count: videoStats.count || 0,
          total_video_size: videoStats.total_size || 0,
          broadcast_count: streamStats.count || 0,
          online_streams: streamStats.online || 0
        };
      } catch (err) {
        console.error(`Error getting stats for user ${user.account_id}:`, err);
        return {
          ...user,
          password_hash: undefined,
          video_count: 0,
          total_video_size: 0,
          broadcast_count: 0,
          online_streams: 0
        };
      }
    }));
    
    await logInfo('User list retrieved', {
      username: req.session.username,
      count: users.length
    });

    res.json({ 
      success: true, 
      users: usersWithStats
    });
  } catch (error) {
    console.error('Get users error:', error);
    await logError('Failed to retrieve users', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET USER STATISTICS (ADMIN ONLY)
// ============================================

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await Account.getStats();
    
    res.json({ 
      success: true, 
      stats 
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    await logError('Failed to retrieve user stats', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET SPECIFIC USER (ADMIN ONLY)
// ============================================

router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await Account.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Don't send password hash
    delete user.password_hash;

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    await logError('Failed to retrieve user', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CREATE NEW USER (ADMIN ONLY)
// ============================================

router.post('/', requireAdmin, [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const { username, password, role, status } = req.body;

    // Check if username already exists
    const existingUser = await Account.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }

    // Generate email dari username
    const email = `${username}@floopystream.local`;
    const displayName = username;
    const isActive = status === 'active';

    const userId = await Account.createNewWithRole(
      username,
      email,
      password,
      displayName,
      role || 'member',
      isActive
    );

    await logInfo('New user created', {
      userId,
      username,
      role: role || 'member',
      status: status || 'active',
      createdBy: req.session.username
    });

    res.json({ 
      success: true, 
      message: 'User created successfully',
      userId 
    });
  } catch (error) {
    console.error('Create user error:', error);
    await logError('Failed to create user', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPDATE USER ROLE (ADMIN ONLY)
// ============================================

router.put('/:id/role', requireAdmin, [
  body('role').isIn(['admin', 'member']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const userId = parseInt(req.params.id);
    const { role } = req.body;

    // Prevent user from demoting themselves
    if (userId === req.session.accountId && role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot change your own role' 
      });
    }

    const user = await Account.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Account.updateRole(userId, role);

    await logInfo('User role updated', {
      userId,
      username: user.username,
      newRole: role,
      updatedBy: req.session.username
    });

    res.json({ 
      success: true, 
      message: 'User role updated successfully' 
    });
  } catch (error) {
    console.error('Update user role error:', error);
    await logError('Failed to update user role', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TOGGLE USER STATUS (ADMIN ONLY)
// ============================================

router.put('/:id/status', requireAdmin, [
  body('isActive').isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const userId = parseInt(req.params.id);
    const { isActive } = req.body;

    // Prevent user from deactivating themselves
    if (userId === req.session.accountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot change your own status' 
      });
    }

    const user = await Account.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Account.toggleStatus(userId, isActive);

    await logInfo('User status updated', {
      userId,
      username: user.username,
      newStatus: isActive ? 'active' : 'inactive',
      updatedBy: req.session.username
    });

    res.json({ 
      success: true, 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (error) {
    console.error('Update user status error:', error);
    await logError('Failed to update user status', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DELETE USER (ADMIN ONLY)
// ============================================

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent user from deleting themselves
    if (userId === req.session.accountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot delete your own account' 
      });
    }

    const user = await Account.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Account.deleteAccount(userId);

    await logInfo('User deleted', {
      userId,
      username: user.username,
      deletedBy: req.session.username
    });

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    await logError('Failed to delete user', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPDATE USER PASSWORD (ADMIN ONLY)
// ============================================

router.put('/:id/password', requireAdmin, [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const userId = parseInt(req.params.id);
    const { password } = req.body;

    const user = await Account.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Account.updatePassword(userId, password);

    await logInfo('User password updated', {
      userId,
      username: user.username,
      updatedBy: req.session.username
    });

    res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    console.error('Update password error:', error);
    await logError('Failed to update password', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
