const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { requireAdmin } = require('../../middleware/authGuard');
const {
  getAllUsers,
  getUserStats,
  getUserById,
  createUser,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  updateUserPassword
} = require('../../controllers/userController');

// ============================================
// USER ROUTES
// ============================================

// Get all users (ADMIN ONLY)
router.get('/', requireAdmin, getAllUsers);

// Get user statistics (ADMIN ONLY)
router.get('/stats', requireAdmin, getUserStats);

// Get specific user (ADMIN ONLY)
router.get('/:id', requireAdmin, getUserById);

// Create new user (ADMIN ONLY)
router.post('/', requireAdmin, [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
], createUser);

// Update user role (ADMIN ONLY)
router.put('/:id/role', requireAdmin, [
  body('role').isIn(['admin', 'member']).withMessage('Invalid role')
], updateUserRole);

// Toggle user status (ADMIN ONLY)
router.put('/:id/status', requireAdmin, [
  body('isActive').isBoolean().withMessage('isActive must be boolean')
], toggleUserStatus);

// Delete user (ADMIN ONLY)
router.delete('/:id', requireAdmin, deleteUser);

// Update user password (ADMIN ONLY)
router.put('/:id/password', requireAdmin, [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], updateUserPassword);

module.exports = router;
