const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authGuard');
const {
  initiateOAuth,
  handleOAuthCallback,
  disconnectOAuth,
  refreshOAuthToken,
  getYouTubeAnalytics,
  getYouTubeAnalyticsByChannel,
  getYouTubeStreamKey,
  checkOAuthStatus,
  forceRefreshOAuthToken
} = require('../../controllers/oauthController');

// ============================================
// OAUTH ROUTES
// ============================================

// Initiate OAuth flow
router.get('/connect/:provider/:channelUuid', requireAuth, initiateOAuth);

// OAuth callback handler
router.get('/:provider/callback', handleOAuthCallback);

// Disconnect OAuth
router.delete('/disconnect/:oauthUuid', requireAuth, disconnectOAuth);

// Refresh OAuth token
router.post('/refresh/:oauthUuid', requireAuth, refreshOAuthToken);

// Get YouTube channel analytics
router.get('/youtube-analytics/:oauthUuid', requireAuth, getYouTubeAnalytics);

// Get YouTube analytics by channel UUID (alternative endpoint)
router.get('/youtube-analytics/channel/:channelUuid', requireAuth, getYouTubeAnalyticsByChannel);

// Get YouTube stream key by channel UUID
router.get('/youtube-streamkey/channel/:channelUuid', requireAuth, getYouTubeStreamKey);

// Check OAuth connection status
router.get('/status/:oauthUuid', requireAuth, checkOAuthStatus);

// Force refresh OAuth token
router.post('/force-refresh/:oauthUuid', requireAuth, forceRefreshOAuthToken);

module.exports = router;