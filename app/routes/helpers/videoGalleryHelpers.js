/**
 * Video/Gallery Route Helpers - Phase 4C
 * Provides utility functions for video and gallery operations with new structure
 */

const { fetchOne, fetchAll, executeQuery } = require('../../core/database');
const Video = require('../../models/Video');
const GalleryVideo = require('../../models/GalleryVideo');

/**
 * Get gallery with complete details and video count
 * @param {string} galleryUuid - Gallery UUID
 * @returns {Promise<Object|null>} Gallery with details
 */
async function getGalleryWithDetails(galleryUuid) {
  try {
    const gallery = await fetchOne(
      `SELECT 
        g.*,
        c.channel_name, c.channel_platform, c.external_id,
        p.project_name,
        COUNT(DISTINCT v.video_id) as video_count,
        COALESCE(SUM(v.filesize), 0) as total_size
       FROM gallery_videos g
       LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
       INNER JOIN channels c ON g.channel_uuid = c.channel_uuid
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       WHERE g.gallery_uuid = ?
       GROUP BY g.gallery_id`,
      [galleryUuid]
    );

    return gallery;
  } catch (error) {
    console.error('Error getting gallery with details:', error);
    return null;
  }
}

/**
 * Get galleries by channel with pagination
 * @param {string} channelUuid - Channel UUID
 * @param {number} limit - Results limit
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of galleries
 */
async function getGalleriesByChannel(channelUuid, limit = 50, offset = 0) {
  try {
    return await fetchAll(
      `SELECT 
        g.*,
        COUNT(DISTINCT v.video_id) as video_count,
        COALESCE(SUM(v.filesize), 0) as total_size
       FROM gallery_videos g
       LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
       WHERE g.channel_uuid = ?
       GROUP BY g.gallery_id
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
      [channelUuid, limit, offset]
    );
  } catch (error) {
    console.error('Error getting galleries by channel:', error);
    return [];
  }
}

/**
 * Get video with complete details
 * @param {string} videoUuid - Video UUID
 * @returns {Promise<Object|null>} Video with gallery and channel details
 */
async function getVideoWithDetails(videoUuid) {
  try {
    const video = await fetchOne(
      `SELECT 
        v.*,
        g.gallery_uuid, g.channel_uuid,
        c.channel_name, c.channel_platform,
        p.project_name
       FROM videos v
       INNER JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
       INNER JOIN channels c ON g.channel_uuid = c.channel_uuid
       INNER JOIN projects p ON c.project_uuid = p.project_uuid
       WHERE v.video_uuid = ?`,
      [videoUuid]
    );

    return video;
  } catch (error) {
    console.error('Error getting video with details:', error);
    return null;
  }
}

/**
 * Get videos by gallery with pagination
 * @param {string} galleryUuid - Gallery UUID
 * @param {number} limit - Results limit
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of videos
 */
async function getVideosByGallery(galleryUuid, limit = 50, offset = 0) {
  try {
    return await fetchAll(
      `SELECT v.*
       FROM videos v
       WHERE v.gallery_uuid = ?
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [galleryUuid, limit, offset]
    );
  } catch (error) {
    console.error('Error getting videos by gallery:', error);
    return [];
  }
}

/**
 * Get videos by channel (across all galleries)
 * @param {string} channelUuid - Channel UUID
 * @param {number} limit - Results limit
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Array of videos
 */
async function getVideosByChannel(channelUuid, limit = 50, offset = 0) {
  try {
    return await fetchAll(
      `SELECT v.*,
        g.gallery_uuid, g.gallery_title
       FROM videos v
       INNER JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
       WHERE g.channel_uuid = ?
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [channelUuid, limit, offset]
    );
  } catch (error) {
    console.error('Error getting videos by channel:', error);
    return [];
  }
}

/**
 * Create gallery from request data
 * @param {string} channelUuid - Channel UUID
 * @param {Object} galleryData - Gallery data from request
 * @returns {Promise<Object>} Created gallery with UUID
 */
async function createGalleryFromData(channelUuid, galleryData) {
  try {
    const result = await GalleryVideo.createEntry(
      channelUuid,
      {
        title: galleryData.title || 'Untitled Gallery',
        description: galleryData.description || '',
        thumbnailPath: galleryData.thumbnailPath || null,
        platformVideoId: galleryData.platformVideoId || null
      },
      galleryData.status || 'active'
    );

    return result;
  } catch (error) {
    console.error('Error creating gallery:', error);
    throw error;
  }
}

/**
 * Create video from request data
 * @param {string} galleryUuid - Gallery UUID
 * @param {Object} videoData - Video data from request
 * @returns {Promise<Object>} Created video with UUID
 */
async function createVideoFromData(galleryUuid, videoData) {
  try {
    const result = await Video.createEntry(
      galleryUuid,
      {
        title: videoData.title || 'Untitled Video',
        description: videoData.description || '',
        filename: videoData.filename,
        filepath: videoData.filepath || null,
        filesize: videoData.filesize || null,
        mimetype: videoData.mimetype || null,
        durationSeconds: videoData.durationSeconds || null,
        thumbnailPath: videoData.thumbnailPath || null
      },
      videoData.status || 'ready'
    );

    return result;
  } catch (error) {
    console.error('Error creating video:', error);
    throw error;
  }
}

/**
 * Get storage usage for channel
 * @param {string} channelUuid - Channel UUID
 * @returns {Promise<Object>} Storage stats
 */
async function getChannelStorageStats(channelUuid) {
  try {
    const result = await fetchOne(
      `SELECT 
        COUNT(DISTINCT g.gallery_id) as gallery_count,
        COUNT(DISTINCT v.video_id) as video_count,
        COALESCE(SUM(v.filesize), 0) as total_size,
        COALESCE(MAX(v.filesize), 0) as largest_video
       FROM gallery_videos g
       LEFT JOIN videos v ON g.gallery_uuid = v.gallery_uuid
       WHERE g.channel_uuid = ?`,
      [channelUuid]
    );

    return result || {
      gallery_count: 0,
      video_count: 0,
      total_size: 0,
      largest_video: 0
    };
  } catch (error) {
    console.error('Error getting channel storage stats:', error);
    return { gallery_count: 0, video_count: 0, total_size: 0, largest_video: 0 };
  }
}

/**
 * Update gallery metadata
 * @param {string} galleryUuid - Gallery UUID
 * @param {Object} updateData - Update data from request
 * @returns {Promise<Object>} Update result
 */
async function updateGalleryFromData(galleryUuid, updateData) {
  try {
    // Get gallery ID from UUID first
    const gallery = await GalleryVideo.findByUuid(galleryUuid);
    if (!gallery) {
      throw new Error('Gallery not found');
    }

    const updates = {};

    if (updateData.title !== undefined) updates.gallery_title = updateData.title;
    if (updateData.description !== undefined) updates.gallery_description = updateData.description;
    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.thumbnailPath !== undefined) updates.thumbnail_path = updateData.thumbnailPath;
    if (updateData.platformVideoId !== undefined) updates.platform_video_id = updateData.platformVideoId;

    if (Object.keys(updates).length === 0) {
      return { changes: 0 };
    }

    return await GalleryVideo.updateMetadata(gallery.gallery_id, updates);
  } catch (error) {
    console.error('Error updating gallery:', error);
    throw error;
  }
}

/**
 * Search videos by title in channel
 * @param {string} channelUuid - Channel UUID
 * @param {string} searchTerm - Search term
 * @param {number} limit - Results limit
 * @returns {Promise<Array>} Matching videos
 */
async function searchVideosByTitle(channelUuid, searchTerm, limit = 50) {
  try {
    return await fetchAll(
      `SELECT v.*, g.gallery_title
       FROM videos v
       INNER JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
       WHERE g.channel_uuid = ? AND (v.video_title LIKE ? OR v.video_description LIKE ?)
       ORDER BY v.created_at DESC
       LIMIT ?`,
      [channelUuid, `%${searchTerm}%`, `%${searchTerm}%`, limit]
    );
  } catch (error) {
    console.error('Error searching videos:', error);
    return [];
  }
}

module.exports = {
  getGalleryWithDetails,
  getGalleriesByChannel,
  getVideoWithDetails,
  getVideosByGallery,
  getVideosByChannel,
  createGalleryFromData,
  createVideoFromData,
  getChannelStorageStats,
  updateGalleryFromData,
  searchVideosByTitle
};
