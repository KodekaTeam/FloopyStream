/**
 * Ownership Verification Helpers - Phase 4C
 * Provides utility functions for verifying resource ownership based on new hierarchical structure
 * 
 * Hierarchy: users → projects → channels → videos/broadcasts/playlists
 */

const { fetchOne, fetchAll } = require('../../core/database');
const UserAdapter = require('../../models/UserAdapter');

/**
 * Verify if user owns a project
 * @param {string} projectUuid - Project UUID
 * @param {number} userId - User ID (from session)
 * @param {string} userRole - User role (admin/member)
 * @returns {Promise<boolean>} True if user owns the project
 */
async function verifyProjectOwnership(projectUuid, userId, userRole) {
  if (userRole === 'admin') return true;

  try {
    // Get project's owner UUID
    const project = await fetchOne(
      'SELECT user_uuid FROM projects WHERE project_uuid = ?',
      [projectUuid]
    );

    if (!project) return false;

    // Get user's UUID from user ID
    const user = await UserAdapter.findById(userId);
    if (!user) return false;

    return user.user_uuid === project.user_uuid;
  } catch (error) {
    console.error('Error verifying project ownership:', error);
    return false;
  }
}

/**
 * Verify if user owns a channel
 * @param {string} channelUuid - Channel UUID
 * @param {number} userId - User ID (from session)
 * @param {string} userRole - User role (admin/member)
 * @returns {Promise<boolean>} True if user owns the channel
 */
async function verifyChannelOwnership(channelUuid, userId, userRole) {
  if (userRole === 'admin') return true;

  try {
    // Get channel's project UUID
    const channel = await fetchOne(
      'SELECT project_uuid FROM channels WHERE channel_uuid = ?',
      [channelUuid]
    );

    if (!channel) return false;

    // Use project ownership verification
    return await verifyProjectOwnership(channel.project_uuid, userId, userRole);
  } catch (error) {
    console.error('Error verifying channel ownership:', error);
    return false;
  }
}

/**
 * Verify if user owns a broadcast
 * @param {string} broadcastUuid - Broadcast UUID
 * @param {number} userId - User ID (from session)
 * @param {string} userRole - User role (admin/member)
 * @returns {Promise<boolean>} True if user owns the broadcast
 */
async function verifyBroadcastOwnership(broadcastUuid, userId, userRole) {
  if (userRole === 'admin') return true;

  try {
    // Get broadcast's channel UUID
    const broadcast = await fetchOne(
      'SELECT channel_uuid FROM broadcasts WHERE broadcast_uuid = ?',
      [broadcastUuid]
    );

    if (!broadcast) return false;

    // Use channel ownership verification
    return await verifyChannelOwnership(broadcast.channel_uuid, userId, userRole);
  } catch (error) {
    console.error('Error verifying broadcast ownership:', error);
    return false;
  }
}

/**
 * Verify if user owns a playlist
 * @param {string} playlistUuid - Playlist UUID
 * @param {number} userId - User ID (from session)
 * @param {string} userRole - User role (admin/member)
 * @returns {Promise<boolean>} True if user owns the playlist
 */
async function verifyPlaylistOwnership(playlistUuid, userId, userRole) {
  if (userRole === 'admin') return true;

  try {
    // Get playlist's channel UUID
    const playlist = await fetchOne(
      'SELECT channel_uuid FROM playlists WHERE playlist_uuid = ?',
      [playlistUuid]
    );

    if (!playlist) return false;

    // Use channel ownership verification
    return await verifyChannelOwnership(playlist.channel_uuid, userId, userRole);
  } catch (error) {
    console.error('Error verifying playlist ownership:', error);
    return false;
  }
}

/**
 * Verify if user owns a video
 * @param {string} videoUuid - Video UUID
 * @param {number} userId - User ID (from session)
 * @param {string} userRole - User role (admin/member)
 * @returns {Promise<boolean>} True if user owns the video
 */
async function verifyVideoOwnership(videoUuid, userId, userRole) {
  if (userRole === 'admin') return true;

  try {
    // Get video's gallery UUID
    const video = await fetchOne(
      'SELECT gallery_uuid FROM videos WHERE video_uuid = ?',
      [videoUuid]
    );

    if (!video) return false;

    // Get gallery's channel UUID
    const gallery = await fetchOne(
      'SELECT channel_uuid FROM gallery_videos WHERE gallery_uuid = ?',
      [video.gallery_uuid]
    );

    if (!gallery) return false;

    // Use channel ownership verification
    return await verifyChannelOwnership(gallery.channel_uuid, userId, userRole);
  } catch (error) {
    console.error('Error verifying video ownership:', error);
    return false;
  }
}

/**
 * Get all owned projects for user
 * @param {number} userId - User ID (from session)
 * @returns {Promise<Array>} Array of project UUIDs
 */
async function getOwnedProjects(userId) {
  try {
    const user = await UserAdapter.findById(userId);
    if (!user) return [];

    const projects = await fetchAll(
      'SELECT project_uuid FROM projects WHERE user_uuid = ?',
      [user.user_uuid]
    );

    return projects.map(p => p.project_uuid);
  } catch (error) {
    console.error('Error getting owned projects:', error);
    return [];
  }
}

/**
 * Get all owned channels for user (across all projects)
 * @param {number} userId - User ID (from session)
 * @returns {Promise<Array>} Array of channel UUIDs
 */
async function getOwnedChannels(userId) {
  try {
    const user = await UserAdapter.findById(userId);
    if (!user) return [];

    const channels = await fetchAll(
      `SELECT c.channel_uuid FROM channels c
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       WHERE p.user_uuid = ?`,
      [user.user_uuid]
    );

    return channels.map(c => c.channel_uuid);
  } catch (error) {
    console.error('Error getting owned channels:', error);
    return [];
  }
}

/**
 * Get channels by project UUID
 * @param {string} projectUuid - Project UUID
 * @returns {Promise<Array>} Array of channel UUIDs in project
 */
async function getChannelsByProject(projectUuid) {
  try {
    const channels = await fetchAll(
      'SELECT channel_uuid FROM channels WHERE project_uuid = ?',
      [projectUuid]
    );

    return channels.map(c => c.channel_uuid);
  } catch (error) {
    console.error('Error getting channels by project:', error);
    return [];
  }
}

module.exports = {
  verifyProjectOwnership,
  verifyChannelOwnership,
  verifyBroadcastOwnership,
  verifyPlaylistOwnership,
  verifyVideoOwnership,
  getOwnedProjects,
  getOwnedChannels,
  getChannelsByProject
};
