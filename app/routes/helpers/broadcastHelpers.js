/**
 * Broadcast Route Helpers - Phase 4C
 * Provides utility functions for broadcast operations with new structure
 */

const { fetchOne, fetchAll, executeQuery } = require('../../core/database');
const Broadcast = require('../../models/Broadcast');
const Video = require('../../models/Video');
const Playlist = require('../../models/Playlist');

/**
 * Get broadcast with complete details
 * @param {string} broadcastUuid - Broadcast UUID
 * @returns {Promise<Object|null>} Broadcast with channel, project, and content details
 */
async function getBroadcastWithDetails(broadcastUuid) {
  try {
    // console.log('Querying broadcast with UUID:', broadcastUuid);
    const broadcast = await fetchOne(
      `SELECT 
        b.*,
        c.channel_name, c.channel_platform, c.external_id,
        p.project_name, p.project_uuid,
        u.user_uuid, u.user_username
       FROM broadcasts b
       INNER JOIN channels c ON b.channel_uuid = c.channel_uuid
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       INNER JOIN users u ON p.user_uuid = u.user_uuid
       WHERE b.broadcast_uuid = ?`,
      [broadcastUuid]
    );

    // console.log('Broadcast query result:', !!broadcast);
    if (!broadcast) return null;

    // Add content details based on broadcast_type
    if (broadcast.broadcast_type === 'single' && broadcast.video_uuid) {
      const video = await Video.findByUuid(broadcast.video_uuid);
      broadcast.video = video;
    } else if (broadcast.broadcast_type === 'playlist') {
      const playlistUuid = broadcast.playlist_uuid || broadcast.video_uuid; // Fallback for backward compatibility
      const playlist = await Playlist.findByUuid(playlistUuid);
      broadcast.playlist = playlist;
      if (playlist) {
        broadcast.playlist.videos = await Playlist.getVideos(playlist.playlist_id);
      }
    }

    return broadcast;
  } catch (error) {
    console.error('Error getting broadcast with details:', error);
    return null;
  }
}

/**
 * Get broadcasts by channel with pagination
 * @param {string} channelUuid - Channel UUID
 * @param {number} limit - Results limit
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of broadcasts
 */
async function getBroadcastsByChannel(channelUuid, limit = 50, offset = 0) {
  try {
    return await fetchAll(
      `SELECT b.*,
        c.channel_name, c.channel_platform,
        p.project_name
       FROM broadcasts b
       INNER JOIN channels c ON b.channel_uuid = c.channel_uuid
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       WHERE b.channel_uuid = ?
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [channelUuid, limit, offset]
    );
  } catch (error) {
    console.error('Error getting broadcasts by channel:', error);
    return [];
  }
}

/**
 * Get active broadcasts for a channel
 * @param {string} channelUuid - Channel UUID
 * @returns {Promise<Array>} Array of active broadcasts
 */
async function getActiveBroadcasts(channelUuid) {
  try {
    return await fetchAll(
      `SELECT b.*, c.channel_name, p.project_name
       FROM broadcasts b
       INNER JOIN channels c ON b.channel_uuid = c.channel_uuid
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       WHERE b.channel_uuid = ? AND b.broadcast_status = 'active'
       ORDER BY b.started_at DESC`,
      [channelUuid]
    );
  } catch (error) {
    console.error('Error getting active broadcasts:', error);
    return [];
  }
}

/**
 * Create broadcast from request data
 * @param {string} channelUuid - Channel UUID
 * @param {Object} broadcastData - Broadcast data from request
 * @returns {Promise<Object>} Created broadcast with UUID
 */
async function createBroadcastFromData(channelUuid, broadcastData) {
  try {
    const broadcast = await Broadcast.createNew(channelUuid, {
      broadcast_name: broadcastData.broadcastName || 'Untitled Broadcast',
      broadcast_type: broadcastData.broadcastType || 'single',
      platform_name: broadcastData.platformName,
      destination_url: broadcastData.destinationUrl,
      stream_key: broadcastData.streamKey || null,
      video_uuid: broadcastData.videoUuid || null,
      scheduled_time: broadcastData.scheduledTime || null,
      loopvideo: broadcastData.loopVideo ? 1 : 0,
      duration_timeout: broadcastData.duration || null,
      advanced_settings: broadcastData.advancedSettings || null
    });

    return broadcast;
  } catch (error) {
    console.error('Error creating broadcast:', error);
    throw error;
  }
}

/**
 * Update broadcast from request data
 * @param {string} broadcastUuid - Broadcast UUID
 * @param {Object} updateData - Update data from request
 * @returns {Promise<Object>} Update result
 */
async function updateBroadcastFromData(broadcastUuid, updateData) {
  try {
    const updates = {};

    if (updateData.broadcast_name !== undefined) updates.broadcast_name = updateData.broadcast_name;
    if (updateData.platform_name !== undefined) updates.platform_name = updateData.platform_name;
    if (updateData.destination_url !== undefined) updates.destination_url = updateData.destination_url;
    if (updateData.stream_key !== undefined) updates.stream_key = updateData.stream_key;
    if (updateData.loopvideo !== undefined) updates.loopvideo = updateData.loopvideo;
    if (updateData.duration_timeout !== undefined) updates.duration_timeout = updateData.duration_timeout;
    if (updateData.scheduled_time !== undefined) updates.scheduled_time = updateData.scheduled_time;
    if (updateData.advanced_settings !== undefined) {
      updates.advanced_settings = typeof updateData.advanced_settings === 'object' 
        ? JSON.stringify(updateData.advanced_settings) 
        : updateData.advanced_settings;
    }

    if (Object.keys(updates).length === 0) {
      return { changes: 0 };
    }

    // Get broadcast to know channel UUID
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    // Update broadcast
    const sql = `UPDATE broadcasts SET ${Object.keys(updates).map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now')
                 WHERE broadcast_uuid = ?`;
    const params = [...Object.values(updates), broadcastUuid];

    return await executeQuery(sql, params);
  } catch (error) {
    console.error('Error updating broadcast:', error);
    throw error;
  }
}

/**
 * Get broadcast count by status for a channel
 * @param {string} channelUuid - Channel UUID
 * @returns {Promise<Object>} Count by status
 */
async function getBroadcastCountByStatus(channelUuid) {
  try {
    const result = await fetchOne(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN broadcast_status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN broadcast_status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN broadcast_status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN broadcast_status = 'error' THEN 1 ELSE 0 END) as errors
       FROM broadcasts
       WHERE channel_uuid = ?`,
      [channelUuid]
    );

    return result || {
      total: 0,
      active: 0,
      scheduled: 0,
      inactive: 0,
      errors: 0
    };
  } catch (error) {
    console.error('Error getting broadcast count by status:', error);
    return { total: 0, active: 0, scheduled: 0, inactive: 0, errors: 0 };
  }
}

module.exports = {
  getBroadcastWithDetails,
  getBroadcastsByChannel,
  getActiveBroadcasts,
  createBroadcastFromData,
  updateBroadcastFromData,
  getBroadcastCountByStatus
};
