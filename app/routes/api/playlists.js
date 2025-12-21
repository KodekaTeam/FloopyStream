const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');

const {
  getPlaylistsByChannel,
  getPlaylistByUuid,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideosToPlaylist,
  reorderPlaylist,
  removeVideoFromPlaylist
} = require('../../controllers/playlistController');

// ============================================
// GET PLAYLISTS BY CHANNEL
// ============================================

/**
 * GET /channel/:channelUuid
 * Get all playlists for a specific channel
 */
router.get('/channel/:channelUuid', requireAuth, getPlaylistsByChannel);

// ============================================
// GET PLAYLIST BY UUID
// ============================================

/**
 * GET /:uuid
 * Get a specific playlist with items
 */
router.get('/:uuid', requireAuth, getPlaylistByUuid);

// ============================================
// CREATE PLAYLIST
// ============================================

/**
 * POST /
 * Create a new playlist
 * 
 * Body:
 * {
 *   channelUuid: "uuid",
 *   playlistName: "My Playlist",
 *   description: "Optional description",
 *   playbackMode: "sequential" | "shuffle"
 * }
 */
router.post('/', requireAuth, createPlaylist);

// ============================================
// UPDATE PLAYLIST
// ============================================

/**
 * PUT /:uuid
 * Update playlist details
 */
router.put('/:uuid', requireAuth, updatePlaylist);

// ============================================
// DELETE PLAYLIST
// ============================================

/**
 * DELETE /:uuid
 * Delete a playlist
 */
router.delete('/:uuid', requireAuth, deletePlaylist);

// ============================================
// ADD VIDEO TO PLAYLIST
// ============================================

/**
 * POST /:uuid/videos
 * Add video(s) to playlist
 * 
 * Body:
 * {
 *   videoUuids: ["uuid1", "uuid2", ...]
 * }
 */
router.post('/:uuid/videos', requireAuth, addVideosToPlaylist);

// ============================================
// REORDER PLAYLIST ITEMS
// ============================================

/**
 * PUT /:uuid/reorder
 * Reorder playlist items
 * 
 * Body:
 * {
 *   itemUuids: ["uuid1", "uuid2", ...] // in new order
 * }
 */
router.put('/:uuid/reorder', requireAuth, reorderPlaylist);

// ============================================
// REMOVE VIDEO FROM PLAYLIST
// ============================================

/**
 * DELETE /:uuid/videos/:videoUuid
 * Remove a video from playlist
 */
router.delete('/:uuid/videos/:videoUuid', requireAuth, removeVideoFromPlaylist);

module.exports = router;

