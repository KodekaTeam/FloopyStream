const express = require('express');
const router = express.Router();

const Playlist = require('../../models/Playlist');
const Content = require('../../models/Content');
const { requireAuth } = require('../../middleware/authGuard');
const { logInfo, logError } = require('../../services/activityLogger');

// ============================================
// CREATE PLAYLIST
// ============================================

router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, description, playbackMode } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Playlist name is required' });
    }

    // Validate playback mode
    const validModes = ['sequential', 'shuffle'];
    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

    const playlistId = await Playlist.createNew(
      req.session.accountId,
      name.trim(),
      description ? description.trim() : '',
      mode
    );

    await logInfo('Playlist created', {
      playlistId,
      name: name.trim(),
      playbackMode: mode,
      username: req.session.username
    });

    res.json({ success: true, playlistId, message: 'Playlist created successfully' });
  } catch (error) {
    console.error('Playlist create error:', error);
    await logError('Failed to create playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPDATE PLAYLIST
// ============================================

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const { name, description, playbackMode } = req.body;

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Check ownership
    if (playlist.account_id !== req.session.accountId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Playlist name is required' });
    }

    // Validate playback mode
    const validModes = ['sequential', 'shuffle'];
    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

    await Playlist.updateDetails(playlistId, name.trim(), description ? description.trim() : '', mode);

    await logInfo('Playlist updated', {
      playlistId,
      name: name.trim(),
      playbackMode: mode,
      username: req.session.username
    });

    res.json({ success: true, message: 'Playlist updated successfully' });
  } catch (error) {
    console.error('Playlist update error:', error);
    await logError('Failed to update playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DELETE PLAYLIST
// ============================================

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Check ownership
    if (playlist.account_id !== req.session.accountId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Playlist.remove(playlistId);

    await logInfo('Playlist deleted', {
      playlistId,
      name: playlist.playlist_name,
      username: req.session.username
    });

    res.json({ success: true, message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Playlist delete error:', error);
    await logError('Failed to delete playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADD VIDEOS TO PLAYLIST
// ============================================

router.post('/:id/videos', requireAuth, async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No videos provided' });
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Check ownership
    if (playlist.account_id !== req.session.accountId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get current max order
    const existingVideos = await Playlist.getVideos(playlistId);
    let maxOrder = existingVideos.length > 0 
      ? Math.max(...existingVideos.map(v => v.order_index))
      : 0;

    // Add each video
    let addedCount = 0;
    for (const videoId of videoIds) {
      const content = await Content.findById(videoId);
      if (!content) continue;

      // Check video ownership
      if (content.account_id !== req.session.accountId) continue;

      // Check if already in playlist
      const alreadyInPlaylist = await Playlist.hasVideo(playlistId, videoId);
      if (alreadyInPlaylist) continue;

      // Add to playlist
      maxOrder++;
      await Playlist.addVideo(playlistId, videoId, maxOrder);
      addedCount++;
    }

    await logInfo('Videos added to playlist', {
      playlistId,
      addedCount,
      username: req.session.username
    });

    res.json({ 
      success: true, 
      message: `${addedCount} video(s) added to playlist`,
      addedCount 
    });
  } catch (error) {
    console.error('Add videos to playlist error:', error);
    await logError('Failed to add videos to playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// MOVE VIDEO IN PLAYLIST
// ============================================

router.put('/:id/videos/:videoId/move', requireAuth, async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const videoId = parseInt(req.params.videoId);
    const { direction } = req.body;

    if (!direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ success: false, message: 'Invalid direction. Use "up" or "down"' });
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Check ownership
    if (playlist.account_id !== req.session.accountId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const moved = await Playlist.moveVideo(playlistId, videoId, direction);
    
    if (!moved) {
      return res.status(400).json({ success: false, message: 'Cannot move video further in that direction' });
    }

    await logInfo('Video moved in playlist', {
      playlistId,
      videoId,
      direction,
      username: req.session.username
    });

    res.json({ success: true, message: `Video moved ${direction}` });
  } catch (error) {
    console.error('Move video in playlist error:', error);
    await logError('Failed to move video in playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// REMOVE VIDEO FROM PLAYLIST
// ============================================

router.delete('/:id/videos/:videoId', requireAuth, async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const videoId = parseInt(req.params.videoId);

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Check ownership
    if (playlist.account_id !== req.session.accountId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Playlist.removeVideo(playlistId, videoId);

    await logInfo('Video removed from playlist', {
      playlistId,
      videoId,
      username: req.session.username
    });

    res.json({ success: true, message: 'Video removed from playlist' });
  } catch (error) {
    console.error('Remove video from playlist error:', error);
    await logError('Failed to remove video from playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
