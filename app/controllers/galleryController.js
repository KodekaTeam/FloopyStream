const GalleryVideo = require('../models/GalleryVideo');
const Video = require('../models/Video');
const Channel = require('../models/Channel');
const Project = require('../models/Project');
const User = require('../models/User');
const { logInfo, logError } = require('../services/activityLogger');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { fetchAll } = require('../core/database');

/**
 * Helper function to verify channel ownership
 */
async function verifyChannelOwnership(channelUuid, userId) {
  const channel = await Channel.findByUuid(channelUuid);
  if (!channel) {
    return { valid: false, message: 'Channel not found' };
  }

  const project = await Project.findByUuid(channel.project_uuid);
  const user = await User.findById(userId);

  if (!project || project.user_uuid !== user.user_uuid) {
    return { valid: false, message: 'Access denied' };
  }

  return { valid: true, channel, project };
}

/**
 * Get all gallery videos for a channel
 */
const getGalleriesByChannel = async (req, res) => {
  try {
    const { channelUuid } = req.params;

    // Verify ownership
    const verification = await verifyChannelOwnership(channelUuid, req.session.accountId);
    if (!verification.valid) {
      return res.status(verification.message === 'Channel not found' ? 404 : 403).json({
        success: false,
        message: verification.message
      });
    }

    const galleries = await GalleryVideo.getByChannel(channelUuid);

    res.json({
      success: true,
      data: galleries
    });
  } catch (error) {
    console.error('Error fetching galleries:', error);
    await logError('Failed to fetch galleries', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery videos'
    });
  }
};

/**
 * Get single gallery video by UUID
 */
const getGalleryByUuid = async (req, res) => {
  try {
    const { galleryUuid } = req.params;
    const gallery = await GalleryVideo.findByUuid(galleryUuid);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery not found'
      });
    }

    // Verify ownership
    const verification = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: gallery
    });
  } catch (error) {
    console.error('Error fetching gallery:', error);
    await logError('Failed to fetch gallery', {
      galleryUuid: req.params.galleryUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery video'
    });
  }
};

/**
 * Create new gallery video
 */
const createGallery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { channelUuid, galleryTitle, galleryDescription, platformVideoId } = req.body;

    // Verify ownership
    const verification = await verifyChannelOwnership(channelUuid, req.session.accountId);
    if (!verification.valid) {
      return res.status(verification.message === 'Channel not found' ? 404 : 403).json({
        success: false,
        message: verification.message
      });
    }

    // Create gallery
    const result = await GalleryVideo.createEntry(channelUuid, {
      title: galleryTitle,
      description: galleryDescription,
      platformVideoId: platformVideoId
    });

    await logInfo('Gallery video created', {
      userId: req.session.accountId,
      galleryId: result.galleryId,
      title: galleryTitle
    });

    res.status(201).json({
      success: true,
      message: 'Gallery video created successfully',
      data: {
        galleryId: result.galleryId,
        galleryUuid: result.galleryUuid
      }
    });
  } catch (error) {
    console.error('Error creating gallery:', error);
    await logError('Failed to create gallery', {
      userId: req.session.accountId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create gallery video'
    });
  }
};

/**
 * Update gallery video
 */
const updateGallery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { galleryUuid } = req.params;
    const gallery = await GalleryVideo.findByUuid(galleryUuid);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery not found'
      });
    }

    // Verify ownership
    const verification = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update gallery - use gallery_id (integer) not UUID
    await GalleryVideo.updateMetadata(gallery.gallery_id, req.body);

    await logInfo('Gallery video updated', {
      userId: req.session.accountId,
      galleryUuid
    });

    res.json({
      success: true,
      message: 'Gallery video updated successfully'
    });
  } catch (error) {
    console.error('Error updating gallery:', error);
    await logError('Failed to update gallery', {
      galleryUuid: req.params.galleryUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update gallery video'
    });
  }
};

/**
 * Delete gallery video
 */
const deleteGallery = async (req, res) => {
  try {
    const { galleryUuid } = req.params;
    const gallery = await GalleryVideo.findByUuid(galleryUuid);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery not found'
      });
    }

    // Verify ownership
    const verification = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if any videos in this gallery are being used in active broadcasts
    const videosInBroadcasts = await fetchAll(`
      SELECT v.video_uuid, v.video_title, b.broadcast_id, b.broadcast_name, b.broadcast_status
      FROM videos v
      JOIN broadcasts b ON v.video_uuid = b.video_uuid
      WHERE v.gallery_uuid = ?
    `, [galleryUuid]);

    if (videosInBroadcasts && videosInBroadcasts.length > 0) {
      const broadcastList = videosInBroadcasts.map(b => {
        const name = b.broadcast_name || `Stream #${b.broadcast_id}`;
        const status = b.broadcast_status.toUpperCase();
        return `${name} (${status})`;
      }).join(', ');

      return res.status(400).json({
        success: false,
        message: `Cannot delete gallery. Videos are being used by: ${broadcastList}`
      });
    }

    // Get all videos in this gallery to delete their files
    const videos = await Video.getByGallery(galleryUuid);

    // Collect all files to delete
    let filesToDelete = [];

    for (const video of videos) {
      if (video.filepath) {
        filesToDelete.push(path.join(__dirname, '../storage/uploads', video.filepath));
      }
      if (video.thumbnail_path) {
        filesToDelete.push(path.join(__dirname, '../storage/thumbnails', video.thumbnail_path));
      }
    }

    // Delete gallery (this will cascade delete videos due to FK constraint)
    await GalleryVideo.deleteGallery(gallery.gallery_id);

    // Delete physical files
    for (const filePath of filesToDelete) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Deleted file:', filePath);
        }
      } catch (err) {
        console.error('Failed to delete file:', filePath, err);
      }
    }

    await logInfo('Gallery video deleted', {
      userId: req.session.accountId,
      galleryUuid
    });

    res.json({
      success: true,
      message: 'Gallery video deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gallery:', error);
    await logError('Failed to delete gallery', {
      galleryUuid: req.params.galleryUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete gallery video'
    });
  }
};

/**
 * Get all videos in a gallery
 */
const getGalleryVideos = async (req, res) => {
  try {
    const { galleryUuid } = req.params;
    const gallery = await GalleryVideo.findByUuid(galleryUuid);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: 'Gallery not found'
      });
    }

    // Verify ownership
    const verification = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const videos = await Video.getByGallery(galleryUuid);

    res.json({
      success: true,
      data: videos
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    await logError('Failed to fetch videos', {
      galleryUuid: req.params.galleryUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch videos'
    });
  }
};

module.exports = {
  getGalleriesByChannel,
  getGalleryByUuid,
  createGallery,
  updateGallery,
  deleteGallery,
  getGalleryVideos
};