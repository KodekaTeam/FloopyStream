const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');
const profileController = require('../../controllers/profileController');

// ============================================
// UPDATE OWN PROFILE
// ============================================

router.put('/update', requireAuth, [
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('displayName').optional().trim()
], profileController.updateProfile);

// ============================================
// CHANGE OWN PASSWORD
// ============================================

router.put('/change-password', requireAuth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], profileController.changePassword);

module.exports = router;
