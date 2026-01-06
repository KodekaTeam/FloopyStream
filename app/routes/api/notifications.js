const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');
const {
  getNotificationChannelById,
  getNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel,
  getNotifications,
  markAllNotificationsAsRead
} = require('../../controllers/notificationController');

// ============================================
// NOTIFICATION ROUTES
// ============================================

// Get notification channel by ID
router.get('/channels/:channelId', requireAuth, getNotificationChannelById);

// Get notification channels for user
router.get('/channels', requireAuth, getNotificationChannels);

// Create notification channel
router.post('/channels', requireAuth, [
  body('provider').isIn(['telegram', 'discord', 'webhook']).withMessage('Provider must be telegram, discord, or webhook'),
  body('botToken').notEmpty().withMessage('Bot token/webhook URL is required'),
  body('externalChatId').optional(),
  body('externalUsername').optional().trim(),
  body('notify_on_upload').optional().isBoolean(),
  body('notify_on_stream').optional().isBoolean(),
  body('notify_on_error').optional().isBoolean(),
  body('notify_on_schedule').optional().isBoolean()
], createNotificationChannel);

// Update notification channel
router.put('/channels/:channelId', requireAuth, [
  body('botToken').optional().notEmpty().withMessage('Bot token/webhook URL cannot be empty'),
  body('externalChatId').optional(),
  body('externalUsername').optional(),
  body('isActive').optional().isBoolean(),
  body('notify_on_upload').optional().isBoolean(),
  body('notify_on_stream').optional().isBoolean(),
  body('notify_on_error').optional().isBoolean(),
  body('notify_on_schedule').optional().isBoolean()
], updateNotificationChannel);

// Delete notification channel
router.delete('/channels/:channelId', requireAuth, deleteNotificationChannel);

// Get notifications (GitHub commits)
router.get('/', requireAuth, getNotifications);

// Mark all notifications as read
router.post('/mark-all-read', requireAuth, markAllNotificationsAsRead);

// Test notification channel
router.post('/channels/:channelId/test', requireAuth, testNotificationChannel);

module.exports = router;