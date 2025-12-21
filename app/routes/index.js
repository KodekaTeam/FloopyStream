const express = require('express');
const router = express.Router();

// Import route modules
const publicAuthRoutes = require('./public/auth');
const protectedPagesRoutes = require('./protected/pages');
const apiContentRoutes = require('./api/content');
const apiBroadcastRoutes = require('./api/broadcast');
const apiPlaylistsRoutes = require('./api/playlists'); // Channel-based playlists
const apiUsersRoutes = require('./api/users');
const apiProfileRoutes = require('./api/profile');
const apiSystemRoutes = require('./api/system');

// New restructured API routes
const apiProjectsRoutes = require('./api/projects');
const apiChannelsRoutes = require('./api/channels');
const apiGalleriesRoutes = require('./api/galleries');
const apiOauthRoutes = require('./api/oauth');
const apiStreamKeysRoutes = require('./api/streamkeys');
const apiNotificationsRoutes = require('./api/notifications');

// ============================================
// PUBLIC ROUTES
// ============================================
router.use('/', publicAuthRoutes);

// ============================================
// PROTECTED PAGE ROUTES
// ============================================
router.use('/', protectedPagesRoutes);

// ============================================
// API ROUTES
// ============================================

// New API Routes (restructured)
router.use('/api/projects', apiProjectsRoutes);
router.use('/api/channels', apiChannelsRoutes);
router.use('/api/galleries', apiGalleriesRoutes);
router.use('/api/oauth', apiOauthRoutes);
router.use('/api/streamkeys', apiStreamKeysRoutes);
router.use('/api/notifications', apiNotificationsRoutes);

// Legacy API Routes (backward compatibility)
// Content API
router.use('/api/content', apiContentRoutes);

// Broadcast API
router.use('/api/broadcast', apiBroadcastRoutes);

// Playlists API
router.use('/api/playlists', apiPlaylistsRoutes);

// Users API (Admin)
router.use('/api/users', apiUsersRoutes);

// Profile API
router.use('/api/profile', apiProfileRoutes);

// System API
router.use('/api/system', apiSystemRoutes);

module.exports = router;
