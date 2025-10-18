const express = require('express');
const router = express.Router();

// Import route modules
const publicAuthRoutes = require('./public/auth');
const protectedPagesRoutes = require('./protected/pages');
const apiContentRoutes = require('./api/content');
const apiBroadcastRoutes = require('./api/broadcast');
const apiPlaylistRoutes = require('./api/playlist');
const apiUsersRoutes = require('./api/users');
const apiProfileRoutes = require('./api/profile');
const apiSystemRoutes = require('./api/system');

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

// Content API
router.use('/api/content', apiContentRoutes);

// Broadcast API
router.use('/api/broadcast', apiBroadcastRoutes);

// Playlist API
router.use('/api/playlist', apiPlaylistRoutes);

// Users API (Admin)
router.use('/api/users', apiUsersRoutes);

// Profile API
router.use('/api/profile', apiProfileRoutes);

// System API
router.use('/api/system', apiSystemRoutes);

module.exports = router;
