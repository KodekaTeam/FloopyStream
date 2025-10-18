const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');
const { getCurrentMetrics } = require('../../services/performanceMonitor');
const { getActiveBroadcastCount } = require('../../services/broadcastEngine');
const { logError } = require('../../services/activityLogger');

// ============================================
// GET SYSTEM STATS
// ============================================

router.get('/', requireAuth, async (req, res) => {
  try {
    const stats = await getCurrentMetrics();
    const activeBroadcastCount = getActiveBroadcastCount();

    // Ensure stats object has expected structure
    const validStats = {
      activeBroadcasts: activeBroadcastCount || 0,
      cpu: stats?.cpu || 0,
      memory: stats?.memory || { used: 0, total: 0, percentage: 0, free: 0 },
      disk: stats?.disk || { used: 0, total: 0, percentage: 0 },
      uptime: stats?.uptime || 0
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      stats: validStats
    });
  } catch (error) {
    console.error('System stats error:', error);
    await logError('Failed to fetch system stats', { error: error.message });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stats: {
        activeBroadcasts: 0,
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0, free: 0 },
        disk: { used: 0, total: 0, percentage: 0 },
        uptime: 0
      }
    });
  }
});

// Alternative route: /stats (for compatibility with old API calls)
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getCurrentMetrics();
    const activeBroadcastCount = getActiveBroadcastCount();

    // Ensure stats object has expected structure
    const validStats = {
      activeBroadcasts: activeBroadcastCount || 0,
      cpu: stats?.cpu || 0,
      memory: stats?.memory || { used: 0, total: 0, percentage: 0, free: 0 },
      disk: stats?.disk || { used: 0, total: 0, percentage: 0 },
      uptime: stats?.uptime || 0
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      stats: validStats
    });
  } catch (error) {
    console.error('System stats error:', error);
    await logError('Failed to fetch system stats', { error: error.message });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stats: {
        activeBroadcasts: 0,
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0, free: 0 },
        disk: { used: 0, total: 0, percentage: 0 },
        uptime: 0
      }
    });
  }
});

module.exports = router;
