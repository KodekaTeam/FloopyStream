const Playlist = require('../models/Playlist');
const Channel = require('../models/Channel');
const User = require('../models/User');
const Project = require('../models/Project');
const { logInfo, logError } = require('../services/activityLogger');
const { executeQuery, fetchAll, fetchOne } = require('../core/database');

// Import ownership helpers
const {
  verifyChannelOwnership
} = require('../routes/helpers/ownershipVerification');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get user's UUID from session
 */
async function getUserUuid(req) {
  const user = await User.findById(req.session.accountId);
  return user?.user_uuid;
}

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

/**
 * Get all playlists for a specific channel
 */
async function getPlaylistsByChannel(req, res) {
  try {
    const { channelUuid } = req.params;

    // Get current user first
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Verify channel ownership
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    // Check if user owns this channel's project
    const project = await Project.findByUuid(channel.project_uuid);
    if (!project || project.user_uuid !== user.user_uuid) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get playlists
    const playlists = await fetchAll(
      `SELECT p.*,
        (SELECT COUNT(*) FROM playlist_items WHERE playlist_uuid = p.playlist_uuid) as video_count
      FROM playlists p
      WHERE p.channel_uuid = ?
      ORDER BY p.created_at DESC`,
      [channelUuid]
    );

    res.json({
      success: true,
      data: playlists,
      count: playlists.length
    });
  } catch (error) {
    console.error('Get playlists by channel error:', error);
    await logError('Failed to get playlists', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get a specific playlist with items
 */
async function getPlaylistByUuid(req, res) {
  try {
    const { uuid } = req.params;

    const playlist = await Playlist.findByUuid(uuid);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Verify channel ownership
    const hasAccess = await verifyChannelOwnership(playlist.channel_uuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get playlist items with video details
    const items = await fetchAll(
      `SELECT pi.*, v.video_title, v.duration_seconds, v.thumbnail_path
      FROM playlist_items pi
      LEFT JOIN videos v ON pi.video_uuid = v.video_uuid
      WHERE pi.playlist_uuid = ?
      ORDER BY pi.order_index ASC`,
      [uuid]
    );

    res.json({
      success: true,
      data: {
        ...playlist,
        items
      }
    });
  } catch (error) {
    console.error('Get playlist error:', error);
    await logError('Failed to get playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create a new playlist
 */
async function createPlaylist(req, res) {
  try {
    const { channelUuid, playlistName, description, playbackMode } = req.body;

    if (!channelUuid) {
      return res.status(400).json({ success: false, message: 'Channel UUID is required' });
    }

    if (!playlistName || playlistName.trim() === '') {
      return res.status(400).json({ success: false, message: 'Playlist name is required' });
    }

    // Verify channel ownership
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const hasAccess = await verifyChannelOwnership(channelUuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Validate playback mode
    const validModes = ['sequential', 'shuffle', 'random'];
    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

    // Create playlist
    const { v4: uuidv4 } = require('uuid');
    const playlistUuid = uuidv4();

    await executeQuery(
      `INSERT INTO playlists (playlist_uuid, channel_uuid, playlist_name, description, playback_mode)
      VALUES (?, ?, ?, ?, ?)`,
      [playlistUuid, channelUuid, playlistName.trim(), description || '', mode]
    );

    await logInfo('Playlist created', {
      playlistUuid,
      channelUuid,
      playlistName: playlistName.trim(),
      playbackMode: mode,
      username: req.session.username
    });

    res.json({
      success: true,
      data: { playlist_uuid: playlistUuid },
      message: 'Playlist created successfully'
    });
  } catch (error) {
    console.error('Playlist create error:', error);
    await logError('Failed to create playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update playlist details
 */
async function updatePlaylist(req, res) {
  try {
    const { uuid } = req.params;
    const { playlistName, description, playbackMode } = req.body;

    const playlist = await Playlist.findByUuid(uuid);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Verify channel ownership
    const hasAccess = await verifyChannelOwnership(playlist.channel_uuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!playlistName || playlistName.trim() === '') {
      return res.status(400).json({ success: false, message: 'Playlist name is required' });
    }

    // Validate playback mode
    const validModes = ['sequential', 'shuffle', 'random'];
    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

    await executeQuery(
      `UPDATE playlists
      SET playlist_name = ?, description = ?, playback_mode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE playlist_uuid = ?`,
      [playlistName.trim(), description || '', mode, uuid]
    );

    await logInfo('Playlist updated', {
      playlistUuid: uuid,
      playlistName: playlistName.trim(),
      playbackMode: mode,
      username: req.session.username
    });

    res.json({ success: true, message: 'Playlist updated successfully' });
  } catch (error) {
    console.error('Playlist update error:', error);
    await logError('Failed to update playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete a playlist
 */
async function deletePlaylist(req, res) {
  try {
    const { uuid } = req.params;

    const playlist = await Playlist.findByUuid(uuid);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Verify channel ownership
    const hasAccess = await verifyChannelOwnership(playlist.channel_uuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if playlist is used in any active broadcasts
    const activeBroadcast = await fetchOne(
      `SELECT * FROM broadcasts
      WHERE playlist_uuid = ? AND broadcast_status IN ('scheduled', 'live')`,
      [uuid]
    );

    if (activeBroadcast) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete playlist: It is being used in an active or scheduled broadcast'
      });
    }

    // Delete playlist items first
    await executeQuery('DELETE FROM playlist_items WHERE playlist_uuid = ?', [uuid]);

    // Delete playlist
    await executeQuery('DELETE FROM playlists WHERE playlist_uuid = ?', [uuid]);

    await logInfo('Playlist deleted', {
      playlistUuid: uuid,
      playlistName: playlist.playlist_name,
      username: req.session.username
    });

    res.json({ success: true, message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Playlist delete error:', error);
    await logError('Failed to delete playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Add video(s) to playlist
 */
async function addVideosToPlaylist(req, res) {
  try {
    const { uuid } = req.params;
    const { videoUuids } = req.body;

    if (!Array.isArray(videoUuids) || videoUuids.length === 0) {
      return res.status(400).json({ success: false, message: 'No videos provided' });
    }

    const playlist = await Playlist.findByUuid(uuid);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Verify channel ownership
    const hasAccess = await verifyChannelOwnership(playlist.channel_uuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get current max order
    const maxOrderResult = await fetchOne(
      'SELECT MAX(order_index) as max_order FROM playlist_items WHERE playlist_uuid = ?',
      [uuid]
    );
    let maxOrder = maxOrderResult?.max_order || 0;

    // Add each video
    const { v4: uuidv4 } = require('uuid');
    let addedCount = 0;

    for (const videoUuid of videoUuids) {
      // Check if video exists and belongs to same channel
      const video = await fetchOne(
        `SELECT v.* FROM videos v
        JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
        WHERE v.video_uuid = ? AND g.channel_uuid = ?`,
        [videoUuid, playlist.channel_uuid]
      );

      if (!video) continue;

      // Check if already in playlist
      const existingItem = await fetchOne(
        'SELECT * FROM playlist_items WHERE playlist_uuid = ? AND video_uuid = ?',
        [uuid, videoUuid]
      );

      if (existingItem) continue;

      // Add to playlist
      maxOrder++;
      const itemUuid = uuidv4();

      await executeQuery(
        'INSERT INTO playlist_items (item_uuid, playlist_uuid, video_uuid, order_index) VALUES (?, ?, ?, ?)',
        [itemUuid, uuid, videoUuid, maxOrder]
      );

      addedCount++;
    }

    await logInfo('Videos added to playlist', {
      playlistUuid: uuid,
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
}

/**
 * Reorder playlist items
 */
async function reorderPlaylist(req, res) {
  try {
    const { uuid } = req.params;
    const { itemUuids } = req.body;

    if (!Array.isArray(itemUuids)) {
      return res.status(400).json({ success: false, message: 'Invalid item order data' });
    }

    const playlist = await Playlist.findByUuid(uuid);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Verify channel ownership
    const hasAccess = await verifyChannelOwnership(playlist.channel_uuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update order for each item
    for (let i = 0; i < itemUuids.length; i++) {
      await executeQuery(
        'UPDATE playlist_items SET order_index = ? WHERE item_uuid = ? AND playlist_uuid = ?',
        [i + 1, itemUuids[i], uuid]
      );
    }

    await logInfo('Playlist reordered', {
      playlistUuid: uuid,
      itemCount: itemUuids.length,
      username: req.session.username
    });

    res.json({ success: true, message: 'Playlist reordered successfully' });
  } catch (error) {
    console.error('Reorder playlist error:', error);
    await logError('Failed to reorder playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Remove a video from playlist
 */
async function removeVideoFromPlaylist(req, res) {
  try {
    const { uuid, videoUuid } = req.params;

    const playlist = await Playlist.findByUuid(uuid);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Verify channel ownership
    const hasAccess = await verifyChannelOwnership(playlist.channel_uuid, req.session.accountId, req.session.userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Remove video from playlist
    await executeQuery(
      'DELETE FROM playlist_items WHERE playlist_uuid = ? AND video_uuid = ?',
      [uuid, videoUuid]
    );

    // Reorder remaining items
    const items = await fetchAll(
      'SELECT * FROM playlist_items WHERE playlist_uuid = ? ORDER BY order_index',
      [uuid]
    );

    for (let i = 0; i < items.length; i++) {
      await executeQuery(
        'UPDATE playlist_items SET order_index = ? WHERE item_uuid = ?',
        [i + 1, items[i].item_uuid]
      );
    }

    await logInfo('Video removed from playlist', {
      playlistUuid: uuid,
      videoUuid,
      username: req.session.username
    });

    res.json({ success: true, message: 'Video removed from playlist' });
  } catch (error) {
    console.error('Remove video from playlist error:', error);
    await logError('Failed to remove video from playlist', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getPlaylistsByChannel,
  getPlaylistByUuid,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideosToPlaylist,
  reorderPlaylist,
  removeVideoFromPlaylist
};