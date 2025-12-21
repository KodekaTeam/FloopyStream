const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');
const { getSystemStats } = require('../../controllers/systemController');

// ============================================
// SYSTEM ROUTES
// ============================================

// Get system stats
router.get('/', requireAuth, getSystemStats);

// Alternative route: /stats (for compatibility with old API calls)
router.get('/stats', requireAuth, getSystemStats);

module.exports = router;
