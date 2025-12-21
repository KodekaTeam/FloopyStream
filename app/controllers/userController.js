const { body, validationResult } = require('express-validator');
const UserAdapter = require('../models/UserAdapter');
const { logInfo, logError } = require('../services/activityLogger');
const { fetchAll } = require('../core/database');

// ============================================
// USER CONTROLLER FUNCTIONS
// ============================================

// Get all users with stats
async function getAllUsers(req, res) {
  try {
    const users = await UserAdapter.getAllUsers();

    // Get content and broadcast counts for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      try {
        // Get video count and total size using new structure
        // Videos are organized by user → projects → channels → galleries → videos
        const videoStats = await fetchAll(`
          SELECT COUNT(*) as count, COALESCE(SUM(v.filesize), 0) as total_size
          FROM videos v
          INNER JOIN gallery_videos gv ON v.gallery_uuid = gv.gallery_uuid
          INNER JOIN channels c ON gv.channel_uuid = c.channel_uuid
          INNER JOIN projects p ON c.project_uuid = p.project_uuid
          WHERE p.user_uuid = ?
        `, [user.user_uuid]);
        const videoData = videoStats[0] || { count: 0, total_size: 0 };

        // Get broadcast/stream count for user's channels
        const streamStats = await fetchAll(`
          SELECT COUNT(*) as count,
                 SUM(CASE WHEN b.broadcast_status = "active" THEN 1 ELSE 0 END) as online
          FROM broadcasts b
          INNER JOIN channels c ON b.channel_uuid = c.channel_uuid
          INNER JOIN projects p ON c.project_uuid = p.project_uuid
          WHERE p.user_uuid = ?
        `, [user.user_uuid]);
        const streamData = streamStats[0] || { count: 0, online: 0 };

        return {
          ...user,
          password_hash: undefined,
          video_count: videoData.count || 0,
          total_video_size: videoData.total_size || 0,
          broadcast_count: streamData.count || 0,
          online_streams: streamData.online || 0
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
}

// Get user statistics
async function getUserStats(req, res) {
  try {
    const stats = await UserAdapter.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    await logError('Failed to retrieve user stats', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get specific user by ID
async function getUserById(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const user = await UserAdapter.findById(userId);

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
}

// Create new user
async function createUser(req, res) {
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
    const existingUser = await UserAdapter.findByUsername(username);
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

    const userId = await UserAdapter.createNewWithRole(
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
}

// Update user role
async function updateUserRole(req, res) {
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

    const user = await UserAdapter.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await UserAdapter.updateRole(userId, role);

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
}

// Toggle user status
async function toggleUserStatus(req, res) {
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

    const user = await UserAdapter.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await UserAdapter.toggleStatus(userId, isActive);

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
}

// Delete user
async function deleteUser(req, res) {
  try {
    const userId = parseInt(req.params.id);

    // Prevent user from deleting themselves
    if (userId === req.session.accountId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await UserAdapter.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await UserAdapter.deleteAccount(userId);

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
}

// Update user password
async function updateUserPassword(req, res) {
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

    const user = await UserAdapter.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await UserAdapter.updatePassword(userId, password);

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
}

module.exports = {
  getAllUsers,
  getUserStats,
  getUserById,
  createUser,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  updateUserPassword
};