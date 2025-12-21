const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Models - New structure only
const GalleryVideo = require('../models/GalleryVideo');
const Video = require('../models/Video');
const Channel = require('../models/Channel');
const Playlist = require('../models/Playlist');

const { extractMediaInfo, createThumbnail } = require('../utilities/mediaProcessor');
const { logInfo, logError } = require('../services/activityLogger');
const { executeQuery, fetchOne, fetchAll } = require('../core/database');

// ============================================
// HELPER: Check if using new database structure
// ============================================
async function hasNewStructure() {
  // Fully migrated to new structure - always return true
  return true;
}

// ============================================
// HELPER: Verify channel ownership
// ============================================
async function verifyChannelOwnership(channelUuid, userId) {
  try {
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) return false;

    // Get project to check user ownership
    const project = await fetchOne(
      'SELECT user_uuid FROM projects WHERE project_uuid = ?',
      [channel.project_uuid]
    );

    if (!project || !project.user_uuid) return false;

    // Get user's UUID
    const user = await fetchOne(
      'SELECT user_uuid FROM users WHERE user_id = ?',
      [userId]
    );

    return user && user.user_uuid === project.user_uuid;
  } catch (error) {
    console.error('Error verifying channel ownership:', error);
    return false;
  }
}

// ============================================
// HELPER: Get or create user's default channel
// ============================================
async function getOrCreateUserDefaultChannel(userId) {
  try {
    // First try to get existing default channel
    const existingChannel = await fetchOne(`
      SELECT c.channel_uuid, c.channel_name
      FROM channels c
      JOIN projects p ON c.project_uuid = p.project_uuid
      JOIN users u ON p.user_uuid = u.user_uuid
      WHERE u.user_id = ?
      ORDER BY c.created_at ASC
      LIMIT 1
    `, [userId]);

    if (existingChannel) {
      return existingChannel;
    }

    // Get user's UUID
    const user = await fetchOne('SELECT user_uuid, user_username FROM users WHERE user_id = ?', [userId]);
    if (!user) {
      return null;
    }

    // Check if user has any projects
    let project = await fetchOne('SELECT project_uuid FROM projects WHERE user_uuid = ?', [user.user_uuid]);

    if (!project) {
      // Create default project
      const projectUuid = uuidv4();
      const now = require('../utils/datetime').getCurrentTimestamp();

      await executeQuery(`
        INSERT INTO projects (project_uuid, user_uuid, project_name, description, type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [projectUuid, user.user_uuid, 'Default Project', 'Default project for uploads', 'multi', 'active', now, now]);

      project = { project_uuid: projectUuid };
    }

    // Create default channel
    const channelName = `${user.user_username}'s Channel`;
    const channelResult = await Channel.createNew(project.project_uuid, channelName, 'internal');

    return {
      channel_uuid: channelResult.channelUuid,
      channel_name: channelName
    };
  } catch (error) {
    console.error('Error getting or creating user default channel:', error);
    return null;
  }
}

// ============================================
// CONTROLLER: Upload Content
// ============================================
async function uploadContent(req, res) {
  try {
    // Handle aborted connections to cleanup partial files
    let aborted = false;
    req.on('aborted', async () => {
      aborted = true;
      console.warn('Upload request aborted by client');
      // If multer already saved files, try to remove them
      try {
        if (req.files && Array.isArray(req.files)) {
          for (const file of req.files) {
            if (file && file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
              console.log('Removed partial upload:', file.path);
            }
          }
        }
      } catch (e) {
        console.error('Failed to remove partial upload:', e.message);
      }
    });

    if (!req.files || req.files.length === 0) {
      if (aborted) {
        return res.status(499).json({ success: false, message: 'Client closed request' });
      }
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const { title, description, channelUuid, galleryUuid } = req.body;
    const uploadedContents = [];
    const errors = [];

    // Get or validate channel
    let targetChannelUuid = channelUuid;
    if (!targetChannelUuid) {
      // Get or create user's default channel
      const defaultChannel = await getOrCreateUserDefaultChannel(req.session.accountId);
      if (!defaultChannel) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create default channel. Please try again.'
        });
      }
      targetChannelUuid = defaultChannel.channel_uuid;
    }

    // Validate channel access
    const hasAccess = await verifyChannelOwnership(targetChannelUuid, req.session.accountId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this channel'
      });
    }

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        // Extract media information
        const mediaInfo = await extractMediaInfo(file.path);

        // Generate thumbnail
        const thumbnailFilename = `thumb_${path.parse(file.filename).name}.jpg`;
        const thumbnailPath = path.join(process.env.THUMBNAIL_DIR || './storage/thumbnails', thumbnailFilename);
        await createThumbnail(file.path, thumbnailPath);

        // Calculate resolution
        const resolution = mediaInfo.width && mediaInfo.height
          ? `${mediaInfo.width}×${mediaInfo.height}`
          : null;

        // Create GalleryVideo + Video
        let gallery;
        if (galleryUuid) {
          gallery = await GalleryVideo.findByUuid(galleryUuid);
          // Verify gallery ownership through channel
          if (gallery) {
            const hasGalleryAccess = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
            if (!hasGalleryAccess) {
              console.warn(`User ${req.session.accountId} attempted to upload to unauthorized gallery ${galleryUuid}`);
              gallery = null; // Force fallback to default gallery
            }
          }
        }

        if (!gallery) {
          // Try to find existing "Uploads" gallery for this channel
          const existingGalleries = await GalleryVideo.getByChannel(targetChannelUuid);
          const uploadsGallery = existingGalleries.find(g => g.gallery_title === 'Uploads');

          if (uploadsGallery) {
            gallery = { gallery_uuid: uploadsGallery.gallery_uuid };
          } else {
            // Create default gallery for channel
            const galleryData = {
              title: 'Uploads',
              description: 'Uploaded videos',
              thumbnailPath: null,
              platformVideoId: null
            };
            const galleryResult = await GalleryVideo.createEntry(targetChannelUuid, galleryData);
            gallery = { gallery_uuid: galleryResult.galleryUuid };
          }
        }

        // Create video entry
        const videoData = {
          title: title || file.originalname,
          description: description || null,
          filename: file.filename,
          filepath: file.filename,
          filesize: file.size,
          mimetype: file.mimetype,
          durationSeconds: mediaInfo.durationSeconds,
          thumbnailPath: thumbnailFilename,
          resolution: resolution
        };

        const result = await Video.createEntry(gallery.gallery_uuid, videoData);

        uploadedContents.push({
          videoId: result.videoId,
          videoUuid: result.videoUuid,
          galleryUuid: gallery.gallery_uuid,
          filename: file.originalname,
          title: videoData.title,
          structure: 'new'
        });

        await logInfo('Video uploaded (new structure)', {
          videoId: result.videoId,
          channelUuid: targetChannelUuid,
          username: req.session.username,
          filename: file.originalname
        });

        // Send upload notification
        try {
          const NotificationService = require('../services/notificationService');
          const User = require('../models/User');
          const user = await User.findById(req.session.accountId);

          if (user) {
            await NotificationService.sendToUserChannels(user.user_uuid, 'upload', {
              title: videoData.title,
              description: videoData.description,
              duration: mediaInfo.durationSeconds ? Math.floor(mediaInfo.durationSeconds) : null,
              filename: file.originalname
            });
          }
        } catch (notificationError) {
          console.error('Upload notification failed:', notificationError);
          // Don't fail the upload if notification fails
        }
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: error.message
        });
        await logError('Upload failed for file', {
          filename: file.originalname,
          error: error.message
        });
      }
    }

    res.json({
      success: uploadedContents.length > 0,
      uploadedContents,
      errors: errors.length > 0 ? errors : undefined,
      message: uploadedContents.length > 0
        ? `${uploadedContents.length} file(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`
        : 'Upload failed'
    });
  } catch (error) {
    console.error('Upload error:', error);
    await logError('Upload failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
}

// ============================================
// CONTROLLER: Get Content Details
// ============================================
async function getContent(req, res) {
  try {
    const { identifier } = req.params;

    // Try to find as video UUID
    let content = await Video.findByUuid(identifier);

    if (content) {
      // Check ownership through gallery -> channel -> project
      const gallery = await GalleryVideo.findByUuid(content.gallery_uuid);
      if (gallery) {
        const hasAccess = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
        if (!hasAccess && req.session.accountRole !== 'admin') {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    if (!content) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ success: false, message: 'Failed to get content' });
  }
}

// ============================================
// CONTROLLER: Update Content
// ============================================
async function updateContent(req, res) {
  try {
    const { identifier } = req.params;
    const { title, description } = req.body;

    console.log('Update content:', { identifier, title, description, hasFile: !!req.file, file: req.file?.filename });

    // Try to update as video
    const video = await Video.findByUuid(identifier);
    if (video) {
      const gallery = await GalleryVideo.findByUuid(video.gallery_uuid);
      if (gallery) {
        const hasAccess = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
        if (!hasAccess && req.session.accountRole !== 'admin') {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      // Prepare updates object
      const updates = {};
      if (title !== undefined) updates.video_title = title;
      if (description !== undefined) updates.video_description = description;
      if (req.file) {
        console.log('Old thumbnail path:', video.thumbnail_path);
        // If updating thumbnail, delete old one if exists
        if (video.thumbnail_path) {
          const oldThumbnailPath = path.join(process.env.THUMBNAIL_DIR || './storage/thumbnails', video.thumbnail_path);
          console.log('Attempting to delete:', oldThumbnailPath);
          if (fs.existsSync(oldThumbnailPath)) {
            try {
              fs.unlinkSync(oldThumbnailPath);
              console.log('Old thumbnail deleted successfully');
            } catch (err) {
              console.warn('Failed to delete old thumbnail:', err);
            }
          } else {
            console.log('Old thumbnail file does not exist');
          }
        }
        console.log('New thumbnail saved to:', req.file.path);
        updates.thumbnail_path = req.file.filename;
      }

      console.log('Updates object:', updates);

      await Video.updateMetadata(video.video_id, updates);

      await logInfo('Video updated', {
        videoUuid: identifier,
        username: req.session.username
      });

      return res.json({ success: true, message: 'Video updated successfully' });
    }

    return res.status(404).json({ success: false, message: 'Video not found' });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ success: false, message: 'Failed to update content' });
  }
}

// ============================================
// CONTROLLER: Delete Content
// ============================================
async function deleteContent(req, res) {
  try {
    const { identifier } = req.params;

    // Try to delete as video
    const video = await Video.findByUuid(identifier);
    if (video) {
      const gallery = await GalleryVideo.findByUuid(video.gallery_uuid);
      if (gallery) {
        const hasAccess = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
        if (!hasAccess && req.session.accountRole !== 'admin') {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      // Check if video is being used in broadcasts
      const relatedBroadcasts = await fetchAll(
        'SELECT broadcast_id, broadcast_name, broadcast_status FROM broadcasts WHERE video_uuid = ?',
        [identifier]
      );

      if (relatedBroadcasts && relatedBroadcasts.length > 0) {
        const broadcastList = relatedBroadcasts.map(b => {
          const name = b.broadcast_name || `Stream #${b.broadcast_id}`;
          const status = b.broadcast_status.toUpperCase();
          return `${name} (${status})`;
        }).join(', ');

        return res.status(400).json({
          success: false,
          message: `Cannot delete video. It is being used by: ${broadcastList}`
        });
      }

      // Collect files to delete
      let filesToDelete = [];
      if (video.filepath) {
        filesToDelete.push(path.join(__dirname, '../storage/uploads', video.filepath));
      }
      if (video.thumbnail_path) {
        filesToDelete.push(path.join(__dirname, '../storage/thumbnails', video.thumbnail_path));
      }

      await Video.deleteVideo(video.video_id);

      // Delete physical files
      for (const filePath of filesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error('Failed to delete file:', filePath, err);
        }
      }

      await logInfo('Video deleted', {
        videoUuid: identifier,
        username: req.session.username
      });

      return res.json({ success: true, message: 'Video deleted successfully' });
    }

    return res.status(404).json({ success: false, message: 'Video not found' });
  } catch (error) {
    console.error('Content delete error:', error);
    await logError('Failed to delete content', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================
// CONTROLLER: Get Content Selector
// ============================================
async function getContentSelector(req, res) {
  try {
    const formattedContent = [];
    const formattedPlaylists = [];

    // Get user's channels
    const userChannels = await fetchAll(`
      SELECT c.channel_uuid
      FROM channels c
      JOIN projects p ON c.project_uuid = p.project_uuid
      JOIN users u ON p.user_uuid = u.user_uuid
      WHERE u.user_id = ?
    `, [req.session.accountId]);

    // Get videos from user's channels
    for (const channel of userChannels) {
      const galleries = await GalleryVideo.getByChannel(channel.channel_uuid);

      for (const gallery of galleries) {
        const videos = await Video.getByGallery(gallery.gallery_uuid);

        for (const video of videos) {
          const duration = video.duration_seconds ? Math.floor(video.duration_seconds) : 0;
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

          formattedContent.push({
            id: video.video_uuid,
            name: video.video_title,
            thumbnail: video.thumbnail_path
              ? `/storage/thumbnails/${video.thumbnail_path}`
              : '/images/default-thumbnail.jpg',
            resolution: video.resolution || 'Unknown',
            duration: formattedDuration,
            filepath: video.filepath,
            type: 'video',
            structure: 'new'
          });
        }
      }
    }

    // Get playlists from user's channels
    const playlists = await fetchAll(`
      SELECT p.*
      FROM playlists p
      JOIN channels c ON p.channel_uuid = c.channel_uuid
      JOIN projects pr ON c.project_uuid = pr.project_uuid
      JOIN users u ON pr.user_uuid = u.user_uuid
      WHERE u.user_id = ?
    `, [req.session.accountId]);

    for (const playlist of playlists) {
      const items = await fetchAll(
        'SELECT COUNT(*) as count FROM playlist_items WHERE playlist_uuid = ?',
        [playlist.playlist_uuid]
      );

      formattedPlaylists.push({
        id: playlist.playlist_uuid,
        name: playlist.playlist_name,
        thumbnail: '/images/playlist-thumbnail.svg',
        resolution: 'Playlist',
        duration: `${items[0]?.count || 0} videos`,
        description: playlist.description,
        type: 'playlist',
        structure: 'new'
      });
    }

    // Combine: playlists first, then content
    const allItems = [...formattedPlaylists, ...formattedContent];

    res.json({ success: true, items: allItems });
  } catch (error) {
    console.error('Get content selector error:', error);
    res.status(500).json({ success: false, message: 'Failed to load content' });
  }
}

// ============================================
// CONTROLLER: Import from Google Drive
// ============================================
async function importFromDrive(req, res) {
  try {
    const { driveUrl, title, description, channelUuid, galleryUuid } = req.body;

    if (!driveUrl) {
      return res.status(400).json({ success: false, message: 'Google Drive URL is required' });
    }

    // Get or validate channel
    let targetChannelUuid = channelUuid;
    if (!targetChannelUuid) {
      // Get or create user's default channel
      const defaultChannel = await getOrCreateUserDefaultChannel(req.session.accountId);
      if (!defaultChannel) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create default channel. Please try again.'
        });
      }
      targetChannelUuid = defaultChannel.channel_uuid;
    }

    // Validate channel access
    const hasAccess = await verifyChannelOwnership(targetChannelUuid, req.session.accountId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this channel'
      });
    }

    const { extractFileId, downloadFile } = require('../utilities/gdriveDownloader');

    let fileId;
    try {
      fileId = extractFileId(driveUrl);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google Drive URL. Please use a valid sharing link.'
      });
    }

    // Create temp filename
    const tempFilename = `drive_${Date.now()}_${fileId}.mp4`;
    const tempPath = path.join(__dirname, '../storage/uploads', tempFilename);

    try {
      await downloadFile(fileId, tempPath, (progress) => {
        // Could emit progress somewhere or log if needed
      });
    } catch (err) {
      console.error('Drive download failed:', err.message || err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to download file from Google Drive'
      });
    }

    // Get file stats
    const stats = fs.statSync(tempPath);

    // Extract media information
    const mediaInfo = await extractMediaInfo(tempPath);

    // Generate thumbnail
    const thumbnailFilename = `thumb_${path.parse(tempFilename).name}.jpg`;
    const thumbnailPath = path.join(process.env.THUMBNAIL_DIR || './storage/thumbnails', thumbnailFilename);
    await createThumbnail(tempPath, thumbnailPath);

    // Calculate resolution
    const resolution = mediaInfo.width && mediaInfo.height
      ? `${mediaInfo.width}×${mediaInfo.height}`
      : null;

    // Create GalleryVideo + Video
    let gallery;
    if (galleryUuid) {
      gallery = await GalleryVideo.findByUuid(galleryUuid);
      // Verify gallery ownership through channel
      if (gallery) {
        const hasGalleryAccess = await verifyChannelOwnership(gallery.channel_uuid, req.session.accountId);
        if (!hasGalleryAccess) {
          console.warn(`User ${req.session.accountId} attempted to import to unauthorized gallery ${galleryUuid}`);
          gallery = null; // Force fallback to default gallery
        }
      }
    }

    if (!gallery) {
      // Try to find existing "Imports from Drive" gallery for this channel
      const existingGalleries = await GalleryVideo.getByChannel(targetChannelUuid);
      const driveGallery = existingGalleries.find(g => g.gallery_title === 'Imports from Drive');

      if (driveGallery) {
        gallery = { gallery_uuid: driveGallery.gallery_uuid };
      } else {
        // Create default gallery
        const galleryData = {
          title: 'Imports from Drive',
          description: 'Videos imported from Google Drive',
          thumbnailPath: null,
          platformVideoId: null
        };
        const galleryResult = await GalleryVideo.createEntry(targetChannelUuid, galleryData);
        gallery = { gallery_uuid: galleryResult.galleryUuid };
      }
    }

    const videoData = {
      title: title || 'Imported from Google Drive',
      description: description || 'Video imported from Google Drive',
      filename: tempFilename,
      filepath: tempFilename,
      filesize: stats.size,
      mimetype: 'video/mp4',
      durationSeconds: mediaInfo.durationSeconds,
      thumbnailPath: thumbnailFilename,
      resolution: resolution
    };

    await Video.createEntry(gallery.gallery_uuid, videoData);

    await logInfo('Video imported from Drive (new structure)', {
      channelUuid: targetChannelUuid,
      username: req.session.username,
      filename: tempFilename,
      fileId: fileId
    });

    // Send upload notification for Google Drive import
    try {
      const NotificationService = require('../services/notificationService');
      const User = require('../models/User');
      const user = await User.findById(req.session.accountId);

      if (user) {
        await NotificationService.sendToUserChannels(user.user_uuid, 'upload', {
          title: videoData.title,
          description: videoData.description,
          duration: mediaInfo.durationSeconds ? Math.floor(mediaInfo.durationSeconds) : null,
          filename: tempFilename
        });
      }
    } catch (notificationError) {
      console.error('Google Drive import notification failed:', notificationError);
      // Don't fail the import if notification fails
    }

    res.json({
      success: true,
      message: 'Video imported successfully from Google Drive'
    });
  } catch (error) {
    console.error('Drive import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to import video from Google Drive'
    });
  }
}

module.exports = {
  uploadContent,
  getContent,
  updateContent,
  deleteContent,
  getContentSelector,
  importFromDrive,
  verifyChannelOwnership,
  getOrCreateUserDefaultChannel
};