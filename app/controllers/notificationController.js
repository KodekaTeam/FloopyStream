const { body, validationResult } = require('express-validator');
const { NotificationChannel } = require('../models/NotificationChannel');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const { logInfo, logError } = require('../services/activityLogger');

// ============================================
// NOTIFICATION CONTROLLER FUNCTIONS
// ============================================

// Get notification channel by ID
async function getNotificationChannelById(req, res) {
  try {
    const { channelId } = req.params;
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify ownership
    const channel = await NotificationChannel.findById(channelId);
    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({
      success: true,
      channel: channel
    });
  } catch (error) {
    console.error('Get notification channel error:', error);
    await logError('Failed to get notification channel', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get notification channels for user
async function getNotificationChannels(req, res) {
  try {
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const channels = await NotificationChannel.getByUser(user.user_uuid);

    res.json({
      success: true,
      channels: channels
    });
  } catch (error) {
    console.error('Get notification channels error:', error);
    await logError('Failed to get notification channels', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// Create notification channel
async function createNotificationChannel(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { provider, botToken, externalChatId, externalUsername, notify_on_upload, notify_on_stream, notify_on_error, notify_on_schedule } = req.body;

    // Additional validation for provider-specific requirements
    if ((provider === 'telegram' || provider === 'discord') && !externalChatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID/Channel ID is required for Telegram and Discord'
      });
    }

    const user = await User.findById(req.session.accountId);

    // Check if user already has a channel for this provider
    const existingChannels = await NotificationChannel.getByProvider(user.user_uuid, provider);
    if (existingChannels.length > 0) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${provider} notification channel configured`
      });
    }

    const result = await NotificationChannel.createNew(user.user_uuid, provider, {
      botToken: botToken,
      externalChatId: externalChatId,
      externalUsername: externalUsername || null,
      notifyOnUpload: notify_on_upload !== undefined ? notify_on_upload : true,
      notifyOnStream: notify_on_stream !== undefined ? notify_on_stream : true,
      notifyOnError: notify_on_error !== undefined ? notify_on_error : true,
      notifyOnSchedule: notify_on_schedule !== undefined ? notify_on_schedule : false
    });

    await logInfo('Notification channel created', {
      accountId: req.session.accountId,
      username: req.session.username,
      provider: provider
    });

    res.json({
      success: true,
      message: `${provider} notification channel created successfully`,
      channelId: result.notificationId
    });
  } catch (error) {
    console.error('Create notification channel error:', error);
    await logError('Failed to create notification channel', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// Update notification channel
async function updateNotificationChannel(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { channelId } = req.params;
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify ownership
    const channel = await NotificationChannel.findById(channelId);
    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updates = {};
    const { botToken, externalChatId, externalUsername, isActive, notify_on_upload, notify_on_stream, notify_on_error, notify_on_schedule } = req.body;

    // Additional validation for provider-specific requirements when updating
    if (externalChatId !== undefined && externalChatId !== '' && (channel.provider === 'telegram' || channel.provider === 'discord') && !externalChatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID/Channel ID cannot be empty for Telegram and Discord'
      });
    }

    if (botToken !== undefined) updates.bot_token = botToken;
    if (externalChatId !== undefined) updates.external_chat_id = externalChatId;
    if (externalUsername !== undefined) updates.external_username = externalUsername;
    if (isActive !== undefined) updates.is_active = isActive;
    if (notify_on_upload !== undefined) updates.notify_on_upload = notify_on_upload;
    if (notify_on_stream !== undefined) updates.notify_on_stream = notify_on_stream;
    if (notify_on_error !== undefined) updates.notify_on_error = notify_on_error;
    if (notify_on_schedule !== undefined) updates.notify_on_schedule = notify_on_schedule;

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }

    await NotificationChannel.updateSettings(channelId, updates);

    await logInfo('Notification channel updated', {
      accountId: req.session.accountId,
      username: req.session.username,
      channelId: channelId
    });

    res.json({
      success: true,
      message: 'Notification channel updated successfully'
    });
  } catch (error) {
    console.error('Update notification channel error:', error);
    await logError('Failed to update notification channel', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// Delete notification channel
async function deleteNotificationChannel(req, res) {
  try {
    const { channelId } = req.params;
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify ownership
    const channel = await NotificationChannel.findById(channelId);
    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await NotificationChannel.deleteChannel(channelId);

    await logInfo('Notification channel deleted', {
      accountId: req.session.accountId,
      username: req.session.username,
      channelId: channelId
    });

    res.json({
      success: true,
      message: 'Notification channel deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification channel error:', error);
    await logError('Failed to delete notification channel', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// Test notification channel
async function testNotificationChannel(req, res) {
  try {
    const { channelId } = req.params;
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify ownership
    const channel = await NotificationChannel.findById(channelId);
    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if channel is active
    if (channel.is_active !== 1) {
      return res.status(400).json({ success: false, message: 'Channel is not active' });
    }

    // Create test message
    const testMessage = NotificationService.formatMessage('test', {
      message: `🧪 Test notification from FloopyStream\n\n✅ Your notification channel is working correctly!\n\n📅 ${new Date().toLocaleString()}\n🔗 Channel: ${channel.provider} ${channel.external_username ? `(${channel.external_username})` : ''}`
    });

    // Send test notification
    const success = await NotificationService.sendNotification(channel, 'test', testMessage);

    if (success) {
      await logInfo('Test notification sent', {
        accountId: req.session.accountId,
        username: req.session.username,
        channelId: channelId,
        provider: channel.provider
      });

      res.json({
        success: true,
        message: 'Test notification sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification. Please check your bot token and chat ID.'
      });
    }
  } catch (error) {
    console.error('Test notification error:', error);
    await logError('Failed to send test notification', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getNotificationChannelById,
  getNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel
};