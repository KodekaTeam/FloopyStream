/**
 * Playlist Route Helpers - Phase 4C
 * Provides utility functions for playlist operations with new structure
 */

const { fetchOne, fetchAll, executeQuery } = require('../../core/database');
const Playlist = require('../../models/Playlist');
const Video = require('../../models/Video');

/**
 * Get playlist with complete details
 * @param {string} playlistUuid - Playlist UUID
 * @returns {Promise<Object|null>} Playlist with channel, project, and videos
 */
async function getPlaylistWithDetails(playlistUuid) {
  try {
    const playlist = await fetchOne(
      `SELECT 
        pl.*,
        c.channel_name, c.channel_platform, c.external_id,
        p.project_name, p.project_uuid,
        u.user_uuid, u.user_username
       FROM playlists pl
       INNER JOIN channels c ON pl.channel_uuid = c.channel_uuid
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       INNER JOIN users u ON p.user_uuid = u.user_uuid
       WHERE pl.playlist_uuid = ?`,
      [playlistUuid]
    );

    if (!playlist) return null;

    // Get videos in playlist
    playlist.videos = await fetchAll(
      `SELECT 
        v.*,
        pi.order_index
       FROM videos v
       INNER JOIN playlist_items pi ON v.video_uuid = pi.video_uuid
       WHERE pi.playlist_uuid = ?
       ORDER BY pi.order_index ASC`,
      [playlistUuid]
    );

    playlist.video_count = playlist.videos.length;

    return playlist;
  } catch (error) {
    console.error('Error getting playlist with details:', error);
    return null;
  }
}

/**
 * Get playlists by channel with pagination
 * @param {string} channelUuid - Channel UUID
 * @param {number} limit - Results limit
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of playlists
 */
async function getPlaylistsByChannel(channelUuid, limit = 50, offset = 0) {
  try {
    const playlists = await fetchAll(
      `SELECT pl.*, COUNT(pi.item_id) as video_count
       FROM playlists pl
       LEFT JOIN playlist_items pi ON pl.playlist_uuid = pi.playlist_uuid
       WHERE pl.channel_uuid = ?
       GROUP BY pl.playlist_id
       ORDER BY pl.created_at DESC
       LIMIT ? OFFSET ?`,
      [channelUuid, limit, offset]
    );

    return playlists;
  } catch (error) {
    console.error('Error getting playlists by channel:', error);
    return [];
  }
}

/**
 * Create playlist from request data
 * @param {string} channelUuid - Channel UUID
 * @param {Object} playlistData - Playlist data from request
 * @returns {Promise<Object>} Created playlist with UUID
 */
async function createPlaylistFromData(channelUuid, playlistData) {
  try {
    const result = await Playlist.createNew(
      channelUuid,
      playlistData.playlistName || 'Untitled Playlist',
      playlistData.description || '',
      playlistData.playbackMode || 'sequential'
    );

    return result;
  } catch (error) {
    console.error('Error creating playlist:', error);
    throw error;
  }
}

/**
 * Update playlist details
 * @param {string} playlistUuid - Playlist UUID
 * @param {Object} updateData - Update data from request
 * @returns {Promise<Object>} Update result
 */
async function updatePlaylistFromData(playlistUuid, updateData) {
  try {
    const updates = {};

    if (updateData.playlistName !== undefined) updates.playlist_name = updateData.playlistName;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.playbackMode !== undefined) updates.playback_mode = updateData.playbackMode;

    if (Object.keys(updates).length === 0) {
      return { changes: 0 };
    }

    const sql = `UPDATE playlists SET ${Object.keys(updates).map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now')
                 WHERE playlist_uuid = ?`;
    const params = [...Object.values(updates), playlistUuid];

    return await executeQuery(sql, params);
  } catch (error) {
    console.error('Error updating playlist:', error);
    throw error;
  }
}

/**
 * Add video to playlist
 * @param {string} playlistUuid - Playlist UUID
 * @param {string} videoUuid - Video UUID
 * @param {number} orderIndex - Order index (optional, calculated if not provided)
 * @returns {Promise<Object>} Added item details
 */
async function addVideoToPlaylist(playlistUuid, videoUuid, orderIndex = null) {
  try {
    // Get current max order index
    if (orderIndex === null) {
      const maxOrder = await fetchOne(
        'SELECT MAX(order_index) as max_order FROM playlist_items WHERE playlist_uuid = ?',
        [playlistUuid]
      );
      orderIndex = (maxOrder?.max_order || -1) + 1;
    }

    // Add video to playlist
    const result = await Playlist.addVideo(null, videoUuid, orderIndex);
    
    return result;
  } catch (error) {
    console.error('Error adding video to playlist:', error);
    throw error;
  }
}

/**
 * Remove video from playlist
 * @param {string} playlistUuid - Playlist UUID
 * @param {string} videoUuid - Video UUID
 * @returns {Promise<Object>} Remove result
 */
async function removeVideoFromPlaylist(playlistUuid, videoUuid) {
  try {
    const result = await Playlist.removeVideo(null, videoUuid);
    return result;
  } catch (error) {
    console.error('Error removing video from playlist:', error);
    throw error;
  }
}

/**
 * Get videos in playlist with pagination
 * @param {string} playlistUuid - Playlist UUID
 * @param {number} limit - Results limit
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of videos in playlist
 */
async function getPlaylistVideos(playlistUuid, limit = 50, offset = 0) {
  try {
    const videos = await fetchAll(
      `SELECT 
        v.*,
        pi.item_uuid, pi.order_index,
        g.channel_uuid
       FROM videos v
       INNER JOIN playlist_items pi ON v.video_uuid = pi.video_uuid
       INNER JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
       WHERE pi.playlist_uuid = ?
       ORDER BY pi.order_index ASC
       LIMIT ? OFFSET ?`,
      [playlistUuid, limit, offset]
    );

    return videos;
  } catch (error) {
    console.error('Error getting playlist videos:', error);
    return [];
  }
}

/**
 * Reorder videos in playlist
 * @param {string} playlistUuid - Playlist UUID
 * @param {Array<{videoUuid, orderIndex}>} reorderData - Video reorder data
 * @returns {Promise<Object>} Reorder result
 */
async function reorderPlaylistVideos(playlistUuid, reorderData) {
  try {
    const updates = [];

    for (const item of reorderData) {
      const sql = `UPDATE playlist_items
                   SET order_index = ?, updated_at = datetime('now')
                   WHERE playlist_uuid = ? AND video_uuid = ?`;
      updates.push(executeQuery(sql, [item.orderIndex, playlistUuid, item.videoUuid]));
    }

    await Promise.all(updates);

    return { changes: updates.length };
  } catch (error) {
    console.error('Error reordering playlist videos:', error);
    throw error;
  }
}

/**
 * Get playlist statistics
 * @param {string} channelUuid - Channel UUID
 * @returns {Promise<Object>} Playlist stats
 */
async function getPlaylistStats(channelUuid) {
  try {
    const result = await fetchOne(
      `SELECT 
        COUNT(DISTINCT pl.playlist_id) as total_playlists,
        COUNT(pi.item_id) as total_items,
        COALESCE(AVG(video_counts.item_count), 0) as avg_videos_per_playlist
       FROM playlists pl
       LEFT JOIN playlist_items pi ON pl.playlist_uuid = pi.playlist_uuid
       LEFT JOIN (
         SELECT playlist_uuid, COUNT(*) as item_count
         FROM playlist_items
         GROUP BY playlist_uuid
       ) video_counts ON pl.playlist_uuid = video_counts.playlist_uuid
       WHERE pl.channel_uuid = ?`,
      [channelUuid]
    );

    return result || {
      total_playlists: 0,
      total_items: 0,
      avg_videos_per_playlist: 0
    };
  } catch (error) {
    console.error('Error getting playlist stats:', error);
    return { total_playlists: 0, total_items: 0, avg_videos_per_playlist: 0 };
  }
}

module.exports = {
  getPlaylistWithDetails,
  getPlaylistsByChannel,
  createPlaylistFromData,
  updatePlaylistFromData,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  getPlaylistVideos,
  reorderPlaylistVideos,
  getPlaylistStats
};
