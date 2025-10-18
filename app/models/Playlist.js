const { executeQuery, fetchOne, fetchAll } = require('../core/database');

/**
 * Playlist Model
 * Manages video playlists for streaming
 */

class Playlist {
  /**
   * Create a new playlist
   */
  static async createNew(accountId, playlistName, description = null, playbackMode = 'sequential') {
    const query = `
      INSERT INTO playlists (account_id, playlist_name, description, playback_mode)
      VALUES (?, ?, ?, ?)
    `;
    
    const result = await executeQuery(query, [accountId, playlistName, description, playbackMode]);
    return result.lastID;
  }

  /**
   * Get playlist by ID
   */
  static async findById(playlistId) {
    const query = `
      SELECT * FROM playlists
      WHERE playlist_id = ?
    `;
    
    return await fetchOne(query, [playlistId]);
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
   * Get all playlists for an account
   */
  static async getByAccount(accountId, limit = 50) {
    const query = `
      SELECT 
        p.*,
        COUNT(pi.item_id) as video_count,
        SUM(CASE WHEN c.duration_seconds IS NOT NULL THEN c.duration_seconds ELSE 0 END) as total_duration
      FROM playlists p
      LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
      LEFT JOIN content c ON pi.content_id = c.content_id
      WHERE p.account_id = ?
      GROUP BY p.playlist_id
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    
    return await fetchAll(query, [accountId, limit]);
  }

  /**
   * Update playlist details
   */
  static async updateDetails(playlistId, playlistName, description, playbackMode = 'sequential') {
    const query = `
      UPDATE playlists
      SET playlist_name = ?, description = ?, playback_mode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE playlist_id = ?
    `;
    
    return await executeQuery(query, [playlistName, description, playbackMode, playlistId]);
  }

  /**
   * Delete playlist
   */
  static async remove(playlistId) {
    // First delete all playlist items
    await executeQuery('DELETE FROM playlist_items WHERE playlist_id = ?', [playlistId]);
    
    // Then delete the playlist
    const query = 'DELETE FROM playlists WHERE playlist_id = ?';
    return await executeQuery(query, [playlistId]);
  }

  /**
   * Add video to playlist
   */
  static async addVideo(playlistId, contentId, orderIndex = null) {
    // If no order specified, add to end
    if (orderIndex === null) {
      const countQuery = 'SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?';
      const result = await fetchOne(countQuery, [playlistId]);
      orderIndex = result.count;
    }

    const query = `
      INSERT INTO playlist_items (playlist_id, content_id, order_index)
      VALUES (?, ?, ?)
    `;
    
    return await executeQuery(query, [playlistId, contentId, orderIndex]);
  }

  /**
   * Remove video from playlist
   */
  static async removeVideo(playlistId, contentId) {
    const query = 'DELETE FROM playlist_items WHERE playlist_id = ? AND content_id = ?';
    return await executeQuery(query, [playlistId, contentId]);
  }

  /**
   * Get all videos in a playlist
   */
  static async getVideos(playlistId) {
    const query = `
      SELECT 
        pi.*,
        c.content_id,
        c.title,
        c.filename,
        c.filepath,
        c.filesize,
        c.duration_seconds,
        c.thumbnail_path,
        c.upload_date as content_created_at
      FROM playlist_items pi
      INNER JOIN content c ON pi.content_id = c.content_id
      WHERE pi.playlist_id = ?
      ORDER BY pi.order_index ASC
    `;
    
    return await fetchAll(query, [playlistId]);
  }

  /**
   * Reorder videos in playlist
   */
  static async reorderVideos(playlistId, videoOrders) {
    // videoOrders is an array of {content_id, order_index}
    for (const item of videoOrders) {
      const query = `
        UPDATE playlist_items
        SET order_index = ?
        WHERE playlist_id = ? AND content_id = ?
      `;
      await executeQuery(query, [item.order_index, playlistId, item.content_id]);
    }
    
    return true;
  }

  /**
   * Move video up or down in playlist
   */
  static async moveVideo(playlistId, contentId, direction) {
    // Get all videos in order
    const videos = await this.getVideos(playlistId);
    
    // Find current video index
    const currentIndex = videos.findIndex(v => v.content_id === parseInt(contentId));
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
    
    const tempOrder = currentVideo.order_index;
    
    // Update current video
    await executeQuery(
      'UPDATE playlist_items SET order_index = ? WHERE playlist_id = ? AND content_id = ?',
      [targetVideo.order_index, playlistId, currentVideo.content_id]
    );
    
    // Update target video
    await executeQuery(
      'UPDATE playlist_items SET order_index = ? WHERE playlist_id = ? AND content_id = ?',
      [tempOrder, playlistId, targetVideo.content_id]
    );

    return true;
  }

  /**
   * Check if video exists in playlist
   */
  static async hasVideo(playlistId, contentId) {
    const query = `
      SELECT COUNT(*) as count
      FROM playlist_items
      WHERE playlist_id = ? AND content_id = ?
    `;
    
    const result = await fetchOne(query, [playlistId, contentId]);
    return result.count > 0;
  }

  /**
   * Duplicate playlist
   */
  static async duplicate(playlistId, accountId, newName = null) {
    const original = await this.findById(playlistId);
    if (!original) return null;

    const name = newName || `${original.playlist_name} (Copy)`;
    const newPlaylistId = await this.createNew(accountId, name, original.description);

    // Copy all videos
    const videos = await this.getVideos(playlistId);
    for (const video of videos) {
      await this.addVideo(newPlaylistId, video.content_id, video.order_index);
    }

    return newPlaylistId;
  }
}

module.exports = Playlist;
