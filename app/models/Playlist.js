const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { formatForDb } = require("../utils/datetime");

/**
 * Playlist Model
 * 
 * Updated for new database structure:
 * - Uses channel_uuid instead of account_id
 * - Uses video_uuid instead of content_id in playlist_items
 * - Uses UUID for playlists and playlist_items
 * - Associates with channels instead of accounts
 */
class Playlist {
  /**
   * Create a new playlist with new structure
   * 
   * @param {string} channelUuid - Channel UUID (required)
   * @param {string} playlistName - Name of the playlist
   * @param {string} description - Optional description
   * @param {string} playbackMode - 'sequential' or other modes
   * @returns {object} - { playlistId, playlistUuid }
   */
  static async createNew(channelUuid, playlistName, description = null, playbackMode = 'sequential') {
    if (!channelUuid) {
      throw new Error('channelUuid is required to create a playlist');
    }

    const playlistUuid = uuidv4();
    const now = formatForDb(new Date());

    const query = `
      INSERT INTO playlists (
        playlist_uuid, channel_uuid, playlist_name, description, playback_mode, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(query, [
      playlistUuid,
      channelUuid,
      playlistName,
      description,
      playbackMode,
      now,
      now
    ]);

    console.log('Playlist created:', {
      playlistId: result.lastID,
      playlistUuid,
      channelUuid,
      playlistName
    });

    return { playlistId: result.lastID, playlistUuid };
  }

  /**
   * Get playlist by ID
   */
  static async findById(playlistId) {
    const query = `
      SELECT 
        p.*,
        ch.channel_name,
        ch.channel_platform
      FROM playlists p
      LEFT JOIN channels ch ON p.channel_uuid = ch.channel_uuid
      WHERE p.playlist_id = ?
    `;
    
    return await fetchOne(query, [playlistId]);
  }

  /**
   * Get playlist by UUID
   */
  static async findByUuid(playlistUuid) {
    const query = `
      SELECT 
        p.*,
        ch.channel_name,
        ch.channel_platform
      FROM playlists p
      LEFT JOIN channels ch ON p.channel_uuid = ch.channel_uuid
      WHERE p.playlist_uuid = ?
    `;
    
    return await fetchOne(query, [playlistUuid]);
  }

  /**
   * Get playlist by ID with videos
   * For streaming service - includes all videos in order
   */
  static async findByIdWithVideos(playlistId) {
    const playlist = await this.findById(playlistId);
    if (!playlist) return null;

    const videos = await this.getVideos(playlistId);
    playlist.videos = videos;
    
    return playlist;
  }

  /**
   * Get all playlists for a channel
   */
  static async getByChannel(channelUuid, limit = 50) {
    const query = `
      SELECT 
        p.*,
        COUNT(pi.item_id) as video_count,
        SUM(CASE WHEN v.duration_seconds IS NOT NULL THEN v.duration_seconds ELSE 0 END) as total_duration,
        ch.channel_name
      FROM playlists p
      LEFT JOIN playlist_items pi ON p.playlist_uuid = pi.playlist_uuid
      LEFT JOIN videos v ON pi.video_uuid = v.video_uuid
      LEFT JOIN channels ch ON p.channel_uuid = ch.channel_uuid
      WHERE p.channel_uuid = ?
      GROUP BY p.playlist_id
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    
    return await fetchAll(query, [channelUuid, limit]);
  }

  /**
   * Get all playlists for an account (legacy)
   * @deprecated Use getByChannel instead
   */
  static async getByAccount(accountId, limit = 50) {
    console.warn('⚠️ Playlist.getByAccount() is deprecated. Use getByChannel() instead.');
    return [];
  }

  /**
   * Update playlist details
   */
  static async updateDetails(playlistId, playlistName, description, playbackMode = 'sequential') {
    const now = formatForDb(new Date());
    const query = `
      UPDATE playlists
      SET playlist_name = ?, description = ?, playback_mode = ?, updated_at = ?
      WHERE playlist_id = ?
    `;
    
    return await executeQuery(query, [playlistName, description, playbackMode, now, playlistId]);
  }

  /**
   * Delete playlist and all its items
   */
  static async remove(playlistId) {
    // First delete all playlist items (cascade delete should handle this, but explicit is safer)
    await executeQuery('DELETE FROM playlist_items WHERE playlist_id = (SELECT playlist_id FROM playlists WHERE playlist_id = ?)', [playlistId]);
    
    // Then delete the playlist
    const query = 'DELETE FROM playlists WHERE playlist_id = ?';
    return await executeQuery(query, [playlistId]);
  }

  /**
   * Add video to playlist
   */
  static async addVideo(playlistId, videoUuid, orderIndex = null) {
    const playlistUuid = await this._getPlaylistUuid(playlistId);
    if (!playlistUuid) {
      throw new Error('Playlist not found');
    }

    // If no order specified, add to end
    if (orderIndex === null) {
      const countQuery = `
        SELECT COUNT(*) as count FROM playlist_items 
        WHERE playlist_uuid = ?
      `;
      const result = await fetchOne(countQuery, [playlistUuid]);
      orderIndex = result.count;
    }

    const itemUuid = uuidv4();
    const now = formatForDb(new Date());
    const query = `
      INSERT INTO playlist_items (
        item_uuid, playlist_uuid, video_uuid, order_index, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return await executeQuery(query, [itemUuid, playlistUuid, videoUuid, orderIndex, now, now]);
  }

  /**
   * Remove video from playlist
   */
  static async removeVideo(playlistId, videoUuid) {
    const playlistUuid = await this._getPlaylistUuid(playlistId);
    if (!playlistUuid) {
      throw new Error('Playlist not found');
    }

    const query = `
      DELETE FROM playlist_items 
      WHERE playlist_uuid = ? AND video_uuid = ?
    `;
    return await executeQuery(query, [playlistUuid, videoUuid]);
  }

  /**
   * Helper: Get playlist_uuid from playlist_id
   */
  static async _getPlaylistUuid(playlistId) {
    const result = await fetchOne(
      'SELECT playlist_uuid FROM playlists WHERE playlist_id = ?',
      [playlistId]
    );
    return result ? result.playlist_uuid : null;
  }

  /**
   * Get all videos in a playlist
   */
  static async getVideos(playlistUuid) {
    const query = `
      SELECT 
        pi.*,
        v.video_id,
        v.video_uuid,
        v.video_title,
        v.filename,
        v.filepath,
        v.filesize,
        v.duration_seconds,
        v.thumbnail_path,
        v.status,
        v.created_at as video_created_at
      FROM playlist_items pi
      INNER JOIN videos v ON pi.video_uuid = v.video_uuid
      WHERE pi.playlist_uuid = ?
      ORDER BY pi.order_index ASC
    `;
    return await fetchAll(query, [playlistUuid]);
  }

  /**
   * Reorder videos in playlist
   */
  static async reorderVideos(playlistId, videoOrders) {
    // videoOrders is an array of {video_uuid, order_index}
    const playlistUuid = await this._getPlaylistUuid(playlistId);
    if (!playlistUuid) {
      throw new Error('Playlist not found');
    }

    const now = formatForDb(new Date());
    for (const item of videoOrders) {
      const query = `
        UPDATE playlist_items
        SET order_index = ?, updated_at = ?
        WHERE playlist_uuid = ? AND video_uuid = ?
      `;
      await executeQuery(query, [item.order_index, now, playlistUuid, item.video_uuid]);
    }
    
    return true;
  }

  /**
   * Move video up or down in playlist
   */
  static async moveVideo(playlistId, videoUuid, direction) {
    // Get all videos in order
    const videos = await this.getVideos(playlistId);
    
    // Find current video index
    const currentIndex = videos.findIndex(v => v.video_uuid === videoUuid);
    if (currentIndex === -1) {
      throw new Error('Video not found in playlist');
    }

    // Calculate new index
    let newIndex = currentIndex;
    if (direction === 'up' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < videos.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      return false; // Can't move further
    }

    // Swap order_index values
    const currentVideo = videos[currentIndex];
    const targetVideo = videos[newIndex];
    const now = formatForDb(new Date());
    
    const tempOrder = currentVideo.order_index;
    
    // Update current video
    await executeQuery(
      'UPDATE playlist_items SET order_index = ?, updated_at = ? WHERE item_uuid = ?',
      [targetVideo.order_index, now, currentVideo.item_uuid]
    );
    
    // Update target video
    await executeQuery(
      'UPDATE playlist_items SET order_index = ?, updated_at = ? WHERE item_uuid = ?',
      [tempOrder, now, targetVideo.item_uuid]
    );

    return true;
  }

  /**
   * Check if video exists in playlist
   */
  static async hasVideo(playlistId, videoUuid) {
    const playlistUuid = await this._getPlaylistUuid(playlistId);
    if (!playlistUuid) {
      throw new Error('Playlist not found');
    }

    const query = `
      SELECT COUNT(*) as count
      FROM playlist_items
      WHERE playlist_uuid = ? AND video_uuid = ?
    `;
    
    const result = await fetchOne(query, [playlistUuid, videoUuid]);
    return result.count > 0;
  }

  /**
   * Duplicate playlist
   */
  static async duplicate(playlistId, channelUuid, newName = null) {
    const original = await this.findById(playlistId);
    if (!original) return null;

    const name = newName || `${original.playlist_name} (Copy)`;
    const { playlistId: newPlaylistId } = await this.createNew(channelUuid, name, original.description);

    // Copy all videos
    const videos = await this.getVideos(playlistId);
    for (const video of videos) {
      await this.addVideo(newPlaylistId, video.video_uuid, video.order_index);
    }

    return newPlaylistId;
  }

  /**
   * Get playlists for user
   */
  static async getByUserUuid(userUuid, limit = 50) {
    const query = `
      SELECT 
        p.*,
        ch.channel_name,
        p.project_name,
        COUNT(pi.item_id) as video_count
      FROM playlists p
      INNER JOIN channels ch ON p.channel_uuid = ch.channel_uuid
      INNER JOIN projects pr ON ch.project_uuid = pr.project_uuid
      INNER JOIN users u ON pr.user_uuid = u.user_uuid
      LEFT JOIN playlist_items pi ON p.playlist_uuid = pi.playlist_uuid
      WHERE u.user_uuid = ?
      GROUP BY p.playlist_id
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    return await fetchAll(query, [userUuid, limit]);
  }
}

module.exports = Playlist;
