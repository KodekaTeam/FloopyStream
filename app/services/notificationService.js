const axios = require('axios');
const { NotificationLog } = require('../models/NotificationChannel');
const { logInfo, logError } = require('./activityLogger');

/**
 * Notification Service - Handles sending notifications to various platforms
 */
class NotificationService {
  /**
   * Send notification to a specific channel
   * @param {Object} channel - Notification channel object
   * @param {string} type - Notification type (upload, stream, error, schedule)
   * @param {string|Object} message - Notification message (string or data object)
   * @returns {Promise<boolean>} Success status
   */
  static async sendNotification(channel, type, message) {
    try {
      let success = false;
      let formattedMessage = message;

      // Format the message for text-based providers (Telegram, Discord)
      if (channel.provider !== 'webhook' && typeof message === 'object') {
        formattedMessage = this.formatMessage(type, message);
      }

      switch (channel.provider) {
        case 'telegram':
          success = await this.sendTelegramNotification(channel, formattedMessage);
          break;
        case 'discord':
          success = await this.sendDiscordNotification(channel, formattedMessage);
          break;
        case 'webhook':
          success = await this.sendWebhookNotification(channel, type, message);
          break;
        default:
          console.warn(`Unknown notification provider: ${channel.provider}`);
          return false;
      }

      // Log the notification attempt
      await NotificationLog.createLog(channel.notification_uuid, type, 
        typeof formattedMessage === 'string' ? formattedMessage : JSON.stringify(formattedMessage), 
        success);

      if (success) {
        logInfo('Notification sent', {
          provider: channel.provider,
          type: type,
          channelId: channel.notification_id
        });
      } else {
        logError('Notification failed', {
          provider: channel.provider,
          type: type,
          channelId: channel.notification_id,
          message: formattedMessage
        });
      }

      return success;
    } catch (error) {
      console.error('Send notification error:', error);
      logError('Notification service error', { error: error.message });

      // Still log the failed attempt
      try {
        const formattedMessage = (channel.provider !== 'webhook' && typeof message === 'object') 
          ? this.formatMessage(type, message) 
          : message;
        await NotificationLog.createLog(channel.notification_uuid, type, 
          typeof formattedMessage === 'string' ? formattedMessage : JSON.stringify(formattedMessage), 
          false);
      } catch (logError) {
        console.error('Failed to log notification:', logError);
      }

      return false;
    }
  }

  /**
   * Send Telegram notification
   * @param {Object} channel - Notification channel
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendTelegramNotification(channel, message) {
    try {
      const botToken = channel.bot_token;
      const chatId = channel.external_chat_id;

      if (!botToken || !chatId) {
        console.error('Telegram bot token or chat ID missing');
        return false;
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }, {
        timeout: 10000 // 10 second timeout
      });

      return response.data && response.data.ok;
    } catch (error) {
      console.error('Telegram notification error:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Send Discord notification
   * @param {Object} channel - Notification channel
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendDiscordNotification(channel, message) {
    try {
      const webhookUrl = channel.bot_token; // For Discord, bot_token stores the webhook URL

      if (!webhookUrl) {
        console.error('Discord webhook URL missing');
        return false;
      }

      const response = await axios.post(webhookUrl, {
        content: message,
        username: 'FloopyStream Bot',
        avatar_url: 'https://your-domain.com/images/bot-avatar.png' // Optional
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.status === 204; // Discord returns 204 on success
    } catch (error) {
      console.error('Discord notification error:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Send Webhook notification with JSON payload
   * @param {Object} channel - Notification channel
   * @param {string} type - Notification type
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  static async sendWebhookNotification(channel, type, message) {
    try {
      const webhookUrl = channel.bot_token; // For webhook, bot_token stores the webhook URL

      if (!webhookUrl) {
        console.error('Webhook URL missing');
        return false;
      }

      // Create JSON payload
      const payload = {
        timestamp: new Date().toISOString(),
        type: type,
        message: message,
        app: process.env.APP_NAME || 'FloopyStream',
        channel_id: channel.notification_id,
        provider: 'webhook'
      };

      const response = await axios.post(webhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FloopyStream-Webhook/1.0'
        }
      });

      // Consider 2xx status codes as success
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Webhook notification error:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Send notification to all active channels for a user
   * @param {string} userUuid - User UUID
   * @param {string} type - Notification type
   * @param {string} message - Notification message
   * @returns {Promise<number>} Number of successful notifications
   */
  static async sendToUserChannels(userUuid, type, message) {
    try {
      const { NotificationChannel } = require('../models/NotificationChannel');
      const channels = await NotificationChannel.getActiveByUser(userUuid);

      let successCount = 0;

      for (const channel of channels) {
        // Check if this type of notification is enabled for this channel
        const typeEnabled = this.isNotificationTypeEnabled(channel, type);
        if (!typeEnabled) continue;

        const success = await this.sendNotification(channel, type, message);
        if (success) successCount++;
      }

      return successCount;
    } catch (error) {
      console.error('Send to user channels error:', error);
      return 0;
    }
  }

  /**
   * Check if notification type is enabled for channel
   * @param {Object} channel - Notification channel
   * @param {string} type - Notification type
   * @returns {boolean} Whether enabled
   */
  static isNotificationTypeEnabled(channel, type) {
    switch (type) {
      case 'upload':
        return channel.notify_on_upload === 1;
      case 'stream':
        return channel.notify_on_stream === 1;
      case 'error':
        return channel.notify_on_error === 1;
      case 'schedule':
        return channel.notify_on_schedule === 1;
      default:
        return false;
    }
  }

  /**
   * Format notification message for different types
   * @param {string} type - Notification type
   * @param {Object} data - Notification data
   * @returns {string} Formatted message
   */
  static formatMessage(type, data) {
    const appName = process.env.APP_NAME || 'FloopyStream';

    switch (type) {
      case 'upload':
        return `📤 <b>${appName}</b>\n\n✅ Video uploaded successfully!\n\n📹 <b>${data.title || 'Untitled'}</b>\n${data.description ? `📝 ${data.description}\n` : ''}⏱️ Duration: ${data.duration || 'N/A'}\n📅 ${new Date().toLocaleString()}`;

      case 'stream':
        return `🎬 <b>${appName}</b>\n\n▶️ Stream started!\n\n📺 <b>${data.name || 'Untitled Stream'}</b>\n${data.description ? `📝 ${data.description}\n` : ''}🔗 Platform: ${data.platform || 'Unknown'}\n📅 ${new Date().toLocaleString()}`;

      case 'error':
        return `❌ <b>${appName} - Error</b>\n\n⚠️ An error occurred:\n\n${data.message || 'Unknown error'}\n${data.details ? `\nDetails: ${data.details}` : ''}\n📅 ${new Date().toLocaleString()}`;

      case 'schedule':
        return `⏰ <b>${appName}</b>\n\n📅 Scheduled event reminder:\n\n📺 <b>${data.name || 'Untitled'}</b>\n🕐 Scheduled for: ${data.scheduledTime ? new Date(data.scheduledTime).toLocaleString() : 'Soon'}\n📅 ${new Date().toLocaleString()}`;

      default:
        return `📢 <b>${appName}</b>\n\n${data.message || 'Notification'}`;
    }
  }
}

module.exports = NotificationService;