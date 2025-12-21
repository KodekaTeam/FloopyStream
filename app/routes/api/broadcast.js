const express = require('express');
const path = require('path');
const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');
const broadcastController = require('../../controllers/broadcastController');

/**
 * POST /start
 * Create a new broadcast
 * 
 * Request format (NEW STRUCTURE):
 * {
 *   channelUuid: "uuid-...",
 *   broadcastName: "Stream Name",
 *   broadcastType: "single" (or "playlist"),
 *   videoUuid: "uuid-..." (or playlistUuid for playlist type),
 *   platformName: "youtube",
 *   destinationUrl: "rtmp://...",
 *   streamKey: "key-...",
 *   scheduledTime: "2024-01-01T12:00:00Z",
 *   loopVideo: true,
 *   duration: 120,
 *   advancedSettings: { bitrate, framerate, resolution, orientation }
 * }
 */
router.post('/start', requireAuth, broadcastController.createBroadcast);

/**
 * POST /start/:broadcastUuid
 * Manually start a broadcast (single video or playlist)
 * 
 * @param {string} broadcastUuid - Broadcast UUID
 * @returns {object} - { success, message }
 */
router.post('/start/:broadcastUuid', requireAuth, broadcastController.startBroadcast);

/**
 * POST /stop/:broadcastUuid
 * Stop an active broadcast
 * 
 * @param {string} broadcastUuid - Broadcast UUID
 * @returns {object} - { success, message }
 */
router.post('/stop/:broadcastUuid', requireAuth, broadcastController.stopBroadcast);

/**
 * GET /:broadcastUuid
 * Get broadcast details by UUID
 * 
 * @param {string} broadcastUuid - Broadcast UUID
 * @returns {object} - { success, broadcast }
 */
router.get('/:broadcastUuid', requireAuth, broadcastController.getBroadcast);

/**
 * PUT /:broadcastUuid
 * Update broadcast configuration
 * 
 * @param {string} broadcastUuid - Broadcast UUID
 * @body {string} broadcast_name - Broadcast name
 * @body {string} destination_url - RTMP destination URL
 * @body {string} stream_key - Stream key (optional)
 * @returns {object} - { success, message }
 */
router.put('/:broadcastUuid', requireAuth, broadcastController.updateBroadcast);

/**
 * DELETE /:broadcastUuid
 * Delete a broadcast
 * 
 * @param {string} broadcastUuid - Broadcast UUID
 * @returns {object} - { success, message }
 */
router.delete('/:broadcastUuid', requireAuth, broadcastController.deleteBroadcast);

/**
 * GET /
 * List broadcasts for a specific channel
 * 
 * @query {string} channelUuid - Channel UUID (required)
 * @query {string} status - Filter by status (optional): active, scheduled, offline, completed
 * @query {number} limit - Number of records (default: 50)
 * @query {number} offset - Offset for pagination (default: 0)
 * @returns {object} - { success, broadcasts, count }
 */
router.get('/', requireAuth, broadcastController.listBroadcasts);

/**
 * GET /active
 * List active broadcasts for all user's channels
 * 
 * @returns {object} - { success, broadcasts, count }
 */
router.get('/active', requireAuth, broadcastController.listActiveBroadcasts);

/**
 * GET /metadata-status/:broadcastUuid
 * Check if broadcast is ready for metadata update
 * 
 * @param {string} broadcastUuid - Broadcast UUID
 * @returns {object} - { success, broadcastStatus, message }
 */
router.get('/metadata-status/:broadcastUuid', requireAuth, broadcastController.checkBroadcastMetadataStatus);

module.exports = router;
