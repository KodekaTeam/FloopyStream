const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const { fetchOne, fetchAll, executeQuery } = require('../core/database');
const OAuthConfig = require('../models/OAuthConfig');

// ============================================
// OAUTH CONFIGURATION
// ============================================

// Get OAuth config for a user (prioritizes global env, falls back to user config)
async function getOAuthConfig(userUuid, provider = 'google') {
  // First, check if global env config is available
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`,
      scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ]
    };
  }

  // Fallback to user-specific config from database
  const userConfig = await OAuthConfig.getByUserUuid(userUuid);

  if (userConfig && userConfig.google_client_id && userConfig.google_client_secret && userConfig.google_redirect_uri) {
    return {
      clientId: userConfig.google_client_id,
      clientSecret: userConfig.google_client_secret,
      redirectUri: userConfig.google_redirect_uri,
      scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ]
    };
  }

  // No config available
  return null;
}

// OAuth configurations for different providers (legacy - kept for backward compatibility)
const OAUTH_CONFIGS = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`,
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ]
  },
  // Add other providers as needed
  facebook: {
    // Facebook OAuth config
  },
  twitch: {
    // Twitch OAuth config
  },
  tiktok: {
    // TikTok OAuth config
  }
};

// ============================================
// OAUTH CONTROLLER FUNCTIONS
// ============================================

// Initiate OAuth flow
async function initiateOAuth(req, res) {
  try {
    const { provider, channelUuid } = req.params;

    // Validate provider
    if (!OAUTH_CONFIGS[provider]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported OAuth provider: ${provider}`
      });
    }

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if channel exists and user has access
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Check ownership through user_uuid
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if OAuth already exists for this channel
    const existingOAuth = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [channelUuid, provider]
    );

    if (existingOAuth) {
      return res.status(400).json({
        success: false,
        message: `OAuth already connected for ${provider}`
      });
    }

    // Get OAuth config for this user
    const oauthConfig = await getOAuthConfig(user.user_uuid, provider);

    // Validate that we have required config
    if (!oauthConfig || !oauthConfig.clientId || !oauthConfig.clientSecret) {
      return res.status(400).json({
        success: false,
        message: `OAuth configuration incomplete. Please set up your ${provider} credentials in Settings > OAuth or configure environment variables.`
      });
    }

    // Generate state parameter for security
    const state = uuidv4();

    // Store state in session for validation
    if (!req.session.oauth_states) {
      req.session.oauth_states = {};
    }
    req.session.oauth_states[state] = {
      provider,
      channelUuid,
      timestamp: Date.now()
    };

    let authUrl;

    if (provider === 'google') {
      const oauth2Client = new google.auth.OAuth2(
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        oauthConfig.redirectUri
      );

      authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: oauthConfig.scopes,
        state: state
      });
    } else {
      return res.status(501).json({
        success: false,
        message: `${provider} OAuth not implemented yet`
      });
    }

    res.json({
      success: true,
      authUrl: authUrl
    });

  } catch (error) {
    console.error('OAuth connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate OAuth flow'
    });
  }
}

// OAuth callback handler
async function handleOAuthCallback(req, res) {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return res.redirect('/channels?oauth_error=' + encodeURIComponent(error));
    }

    // Validate state parameter
    if (!state || !req.session.oauth_states || !req.session.oauth_states[state]) {
      return res.redirect('/channels?oauth_error=invalid_state');
    }

    const stateData = req.session.oauth_states[state];
    delete req.session.oauth_states[state]; // Clean up used state

    // Check if state is not expired (5 minutes)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return res.redirect('/channels?oauth_error=state_expired');
    }

    const { channelUuid } = stateData;

    // Get the user who initiated this OAuth flow
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.redirect('/channels?oauth_error=channel_not_found');
    }

    // Get OAuth config for this user
    const oauthConfig = await getOAuthConfig(channel.user_uuid, provider);

    if (provider === 'google') {
      const oauth2Client = new google.auth.OAuth2(
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        oauthConfig.redirectUri
      );

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      console.log('OAuth tokens received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date
      });

      // Generate UUID for OAuth record
      const oauthUuid = uuidv4();

      // Fetch YouTube channel ID from Google's API
      let youtubeChannelId = null;
      try {
        const youtube = google.youtube({
          version: 'v3',
          auth: oauth2Client
        });
        
        const channelResponse = await youtube.channels.list({
          part: 'id',
          mine: true
        });

        if (channelResponse.data.items && channelResponse.data.items.length > 0) {
          youtubeChannelId = channelResponse.data.items[0].id;
          console.log('YouTube channel ID fetched:', youtubeChannelId);
        }
      } catch (youtubeError) {
        console.warn('Could not fetch YouTube channel ID:', youtubeError.message);
      }

      // Store OAuth credentials
      await executeQuery(`
        INSERT INTO oauth_credentials (
          oauth_uuid, channel_uuid, provider, client_id, client_secret,
          access_token, refresh_token, token_type, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        oauthUuid,
        channelUuid,
        provider,
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_type,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
      ]);

      // Update channel with YouTube channel ID if obtained
      if (youtubeChannelId) {
        await executeQuery(`
          UPDATE channels SET external_id = ? WHERE channel_uuid = ?
        `, [youtubeChannelId, channelUuid]);
      }

      res.redirect(`/channels/${channelUuid}?oauth_success=1`);
    } else {
      res.redirect('/channels?oauth_error=unsupported_provider');
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/channels?oauth_error=callback_failed');
  }
}

// Disconnect OAuth
async function disconnectOAuth(req, res) {
  try {
    const { oauthUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get OAuth record
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE oauth_uuid = ?',
      [oauthUuid]
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'OAuth record not found'
      });
    }

    // Check if user owns this OAuth (through channel ownership)
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(oauthRecord.channel_uuid);

    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete OAuth record
    await executeQuery(
      'DELETE FROM oauth_credentials WHERE oauth_uuid = ?',
      [oauthUuid]
    );

    res.json({
      success: true,
      message: 'OAuth disconnected successfully'
    });

  } catch (error) {
    console.error('OAuth disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect OAuth'
    });
  }
}

// Refresh OAuth token
async function refreshOAuthToken(req, res) {
  try {
    const { oauthUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get OAuth record
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE oauth_uuid = ?',
      [oauthUuid]
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'OAuth record not found'
      });
    }

    // Check if user owns this OAuth
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(oauthRecord.channel_uuid);

    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (oauthRecord.provider === 'google') {
      // Check if refresh token exists
      if (!oauthRecord.refresh_token) {
        return res.status(400).json({
          success: false,
          message: 'No refresh token available. Please reconnect OAuth to get a new refresh token.'
        });
      }

      // Resolve OAuth client credentials (older records may have null client_id/client_secret)
      let clientId = oauthRecord.client_id || process.env.GOOGLE_CLIENT_ID;
      let clientSecret = oauthRecord.client_secret || process.env.GOOGLE_CLIENT_SECRET;
      let redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`;

      if ((!clientId || !clientSecret) || !oauthRecord.client_id || !oauthRecord.client_secret) {
        const userConfig = await OAuthConfig.getByUserUuid(user.user_uuid);
        if (userConfig?.google_client_id && userConfig?.google_client_secret) {
          clientId = clientId || userConfig.google_client_id;
          clientSecret = clientSecret || userConfig.google_client_secret;
          redirectUri = userConfig.google_redirect_uri || redirectUri;
        }
      }

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          message: 'Google OAuth credentials are missing. Please configure Settings > OAuth (Google Client ID/Secret) or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then try again.'
        });
      }

      // Persist resolved credentials back into oauth_credentials so future refreshes work.
      if (clientId !== oauthRecord.client_id || clientSecret !== oauthRecord.client_secret) {
        await executeQuery(
          'UPDATE oauth_credentials SET client_id = ?, client_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE oauth_uuid = ?',
          [clientId, clientSecret, oauthUuid]
        );
        oauthRecord.client_id = clientId;
        oauthRecord.client_secret = clientSecret;
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: oauthRecord.refresh_token
      });

      // Refresh token
      let refreshResult;
      if (typeof oauth2Client.refreshAccessToken === 'function') {
        refreshResult = await oauth2Client.refreshAccessToken();
      } else if (typeof oauth2Client.refreshToken === 'function') {
        refreshResult = await oauth2Client.refreshToken(oauthRecord.refresh_token);
      } else {
        refreshResult = await oauth2Client.getAccessToken();
      }

      const newTokens = (refreshResult && refreshResult.credentials)
        || (refreshResult && refreshResult.tokens)
        || oauth2Client.credentials
        || {};

      const accessToken = newTokens.access_token
        || (refreshResult && refreshResult.token)
        || (typeof refreshResult === 'string' ? refreshResult : null)
        || oauth2Client.credentials?.access_token;

      if (!accessToken) {
        throw new Error('OAuth refresh succeeded but no access_token was returned');
      }

      // Update database
      await executeQuery(`
        UPDATE oauth_credentials
        SET access_token = ?, refresh_token = ?, token_type = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE oauth_uuid = ?
      `, [
        accessToken,
        newTokens.refresh_token || oauthRecord.refresh_token,
        newTokens.token_type,
        newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null,
        oauthUuid
      ]);

      res.json({
        success: true,
        message: 'OAuth token refreshed successfully'
      });
    } else {
      res.status(501).json({
        success: false,
        message: `${oauthRecord.provider} token refresh not implemented`
      });
    }

  } catch (error) {
    console.error('OAuth refresh error:', error);

    // Handle Google API structured errors (gaxios)
    const apiError = error?.response?.data?.error || error?.message;
    if (apiError === 'invalid_request') {
      return res.status(400).json({
        success: false,
        message: 'Google OAuth refresh failed: invalid_request. This usually means the client credentials (Client ID/Secret) are missing or incorrect. Please verify Settings > OAuth or your .env and reconnect if needed.'
      });
    }

    // Handle specific Google OAuth errors
    if (error.message && error.message.includes('No refresh token is set')) {
      return res.status(400).json({
        success: false,
        message: 'No refresh token available. Please reconnect OAuth to get a new refresh token.'
      });
    }

    if (error.message && error.message.includes('invalid_grant')) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is invalid or expired. Please reconnect OAuth.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to refresh OAuth token'
    });
  }
}

// Get YouTube channel analytics
async function getYouTubeAnalytics(req, res) {
  try {
    const { oauthUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get OAuth record
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE oauth_uuid = ?',
      [oauthUuid]
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'OAuth record not found'
      });
    }

    // Check if user owns this OAuth
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(oauthRecord.channel_uuid);

    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Import YouTube service
    const youtubeService = require('../services/youtubeService');

    // Get channel analytics
    const result = await youtubeService.getChannelAnalytics(oauthUuid);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch YouTube analytics'
      });
    }

  } catch (error) {
    console.error('YouTube analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch YouTube analytics'
    });
  }
}

// Get YouTube analytics by channel UUID (alternative endpoint)
async function getYouTubeAnalyticsByChannel(req, res) {
  try {
    const { channelUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get channel
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Check ownership
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get OAuth record for this channel
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [channelUuid, 'google']
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'No YouTube OAuth connection found for this channel'
      });
    }

    // Import YouTube service
    const youtubeService = require('../services/youtubeService');

    // Get channel analytics
    const result = await youtubeService.getChannelAnalytics(oauthRecord.oauth_uuid);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch YouTube analytics'
      });
    }

  } catch (error) {
    console.error('YouTube analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch YouTube analytics'
    });
  }
}

// Get YouTube stream key by channel UUID
async function getYouTubeStreamKey(req, res) {
  try {
    const { channelUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get channel
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Check ownership
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get OAuth record for this channel
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [channelUuid, 'google']
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'No YouTube OAuth connection found for this channel'
      });
    }

    // Import YouTube service
    const youtubeService = require('../services/youtubeService');

    // Get stream key
    const result = await youtubeService.getStreamKey(oauthRecord.oauth_uuid);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch YouTube stream key'
      });
    }

  } catch (error) {
    console.error('YouTube stream key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch YouTube stream key'
    });
  }
}

// Check OAuth connection status
async function checkOAuthStatus(req, res) {
  try {
    const { oauthUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get OAuth record
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE oauth_uuid = ?',
      [oauthUuid]
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'OAuth record not found'
      });
    }

    // Check if user owns this OAuth
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(oauthRecord.channel_uuid);

    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Import YouTube service
    const youtubeService = require('../services/youtubeService');

    // Check connection status
    const status = await youtubeService.checkConnectionStatus(oauthUuid);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('OAuth status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check OAuth status'
    });
  }
}

// Force refresh OAuth token
async function forceRefreshOAuthToken(req, res) {
  try {
    const { oauthUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get OAuth record
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE oauth_uuid = ?',
      [oauthUuid]
    );

    if (!oauthRecord) {
      return res.status(404).json({
        success: false,
        message: 'OAuth record not found'
      });
    }

    // Check if user owns this OAuth
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(oauthRecord.channel_uuid);

    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Import YouTube service
    const youtubeService = require('../services/youtubeService');

    // Force refresh token
    const refreshed = await youtubeService.refreshOAuthToken(oauthRecord);

    if (refreshed) {
      res.json({
        success: true,
        message: 'OAuth token refreshed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to refresh OAuth token. No refresh token available.'
      });
    }

  } catch (error) {
    console.error('OAuth force refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to force refresh OAuth token'
    });
  }
}

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  disconnectOAuth,
  refreshOAuthToken,
  getYouTubeAnalytics,
  getYouTubeAnalyticsByChannel,
  getYouTubeStreamKey,
  checkOAuthStatus,
  forceRefreshOAuthToken
};