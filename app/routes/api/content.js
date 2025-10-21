const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Content = require('../../models/Content');
const Playlist = require('../../models/Playlist');
const { requireAuth } = require('../../middleware/authGuard');
const { videoUploader, handleUploadError } = require('../../middleware/fileUpload');
const { extractMediaInfo, createThumbnail } = require('../../utilities/mediaProcessor');
const { logInfo, logError } = require('../../services/activityLogger');
const { executeQuery } = require('../../core/database');

// Rate limiting for uploads
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests, please try again later'
});

// ============================================
// UPLOAD CONTENT
// ============================================

router.post('/upload', requireAuth, apiLimiter, videoUploader, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { title, description } = req.body;

    // Timing / debug logs to diagnose upload/post-processing slowness
    const uploadHandlerStart = Date.now();
    console.log(`[upload] handler invoked for user=${req.session && req.session.username ? req.session.username : 'unknown'} file=${req.file.originalname} size=${req.file.size}`);

    // Extract media information
    const t1 = Date.now();
    const mediaInfo = await extractMediaInfo(req.file.path);
    const t2 = Date.now();
    console.log(`[upload] extractMediaInfo took ${t2 - t1} ms for file=${req.file.filename}`);

    // Generate thumbnail
    const thumbStart = Date.now();
    const thumbnailFilename = `thumb_${path.parse(req.file.filename).name}.jpg`;
    const thumbnailPath = path.join(process.env.THUMBNAIL_DIR || './storage/thumbnails', thumbnailFilename);
    await createThumbnail(req.file.path, thumbnailPath);
    const thumbEnd = Date.now();
    console.log(`[upload] createThumbnail took ${thumbEnd - thumbStart} ms for file=${req.file.filename}`);

    // Calculate resolution
    const resolution = mediaInfo.width && mediaInfo.height 
      ? `${mediaInfo.width}×${mediaInfo.height}` 
      : null;

    // Create content entry
    const contentData = {
      title: title || req.file.originalname,
      description: description || null,
      filename: req.file.filename,
      filepath: req.file.filename, // Store only filename, not full path
      filesize: req.file.size,
      mimetype: req.file.mimetype,
      durationSeconds: mediaInfo.durationSeconds,
      thumbnailPath: thumbnailFilename, // Store only filename (e.g., thumb_xxx.jpg)
      resolution: resolution
    };

    const result = await Content.createEntry(req.session.accountId, contentData);
    
    await logInfo('Content uploaded', { 
      contentId: result.contentId,
      username: req.session.username,
      filename: req.file.originalname
    });

    res.json({ 
      success: true, 
      message: 'Content uploaded successfully',
      contentId: result.contentId
    });
  } catch (error) {
    console.error('Upload error:', error);
    await logError('Content upload failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ============================================
// GET CONTENT DETAILS
// ============================================

router.get('/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }
    
    // Check ownership
    if (content.account_id !== req.session.accountId && req.session.accountRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({ success: true, content });
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ success: false, message: 'Failed to get content' });
  }
});

// ============================================
// UPDATE CONTENT
// ============================================

router.put('/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { title, description } = req.body;
    
    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }
    
    // Check ownership
    if (content.account_id !== req.session.accountId && req.session.accountRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Update content
    await executeQuery(
      'UPDATE content SET title = ?, description = ? WHERE content_id = ?',
      [title, description || null, contentId]
    );
    
    await logInfo('Content updated', {
      contentId,
      username: req.session.username
    });
    
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ success: false, message: 'Failed to update content' });
  }
});

// ============================================
// DELETE CONTENT
// ============================================

router.delete('/:contentId', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.params;
    
    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Check ownership
    if (content.account_id !== req.session.accountId && req.session.accountRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if video is being used in any broadcasts (active, scheduled, or offline)
    console.log('Checking broadcasts for content_id:', contentId);
    const relatedBroadcasts = await executeQuery(
      'SELECT broadcast_id, broadcast_name, broadcast_status FROM broadcasts WHERE content_id = ?',
      [contentId]
    );
    
    console.log('Related broadcasts found:', relatedBroadcasts);

    if (relatedBroadcasts && relatedBroadcasts.length > 0) {
      const broadcastList = relatedBroadcasts.map(b => {
        const name = b.broadcast_name || `Stream #${b.broadcast_id}`;
        const status = b.broadcast_status.toUpperCase();
        return `${name} (${status})`;
      }).join(', ');
      
      console.log('Delete blocked. Broadcasts using this video:', broadcastList);
      
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete video. It is being used by the following broadcast(s): ${broadcastList}. Please delete the broadcast(s) first.` 
      });
    }
    
    console.log('No related broadcasts, proceeding with delete');

    // Delete physical files
    if (content.filepath) {
      // Filepath now stores only filename, construct full path
      const filePath = path.join(__dirname, '../../storage/uploads', content.filepath);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (content.thumbnail_path) {
      // thumbnail_path stores relative path like 'thumbnails/filename.jpg'
      const thumbPath = path.join(__dirname, '../../storage', content.thumbnail_path);
      
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    // Delete database record
    await executeQuery('DELETE FROM content WHERE content_id = ?', [contentId]);
    
    await logInfo('Content deleted', { 
      contentId,
      username: req.session.username
    });

    res.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Content delete error:', error);
    await logError('Failed to delete content', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET CONTENT SELECTOR
// ============================================

router.get('/selector/all', requireAuth, async (req, res) => {
  try {
    // Get all content
    const contentList = await Content.getByAccount(req.session.accountId, 1000);
    
    // Format content
    const formattedContent = contentList.map(content => {
      const duration = content.duration_seconds ? Math.floor(content.duration_seconds) : 0;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      return {
        id: content.content_id,
        name: content.title,
        thumbnail: content.thumbnail_path || '/images/default-thumbnail.jpg',
        resolution: content.resolution || '1280×720',
        duration: formattedDuration,
        filepath: content.filepath,
        type: 'content'
      };
    });

    // Get all playlists
    const playlists = await Playlist.getByAccount(req.session.accountId, 1000);
    
    // Format playlists
    const formattedPlaylists = playlists.map(playlist => {
      return {
        id: playlist.playlist_id,
        name: playlist.playlist_name,
        thumbnail: '/images/playlist-thumbnail.svg',
        resolution: 'Playlist',
        duration: `${playlist.video_count || 0} videos`,
        description: playlist.description,
        type: 'playlist'
      };
    });

    // Combine: playlists first, then content
    const allItems = [...formattedPlaylists, ...formattedContent];
    
    res.json({ success: true, items: allItems });
  } catch (error) {
    console.error('Get content selector error:', error);
    res.status(500).json({ success: false, message: 'Failed to load content' });
  }
});

// ============================================
// IMPORT FROM GOOGLE DRIVE
// ============================================

router.post('/drive/import-url', requireAuth, async (req, res) => {
  try {
    const { driveUrl, title, description } = req.body;
    
    if (!driveUrl) {
      return res.status(400).json({ success: false, message: 'Google Drive URL is required' });
    }
    
    const { extractFileId, downloadFile } = require('../../utilities/gdriveDownloader');

    let fileId;
    try {
      fileId = extractFileId(driveUrl);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid Google Drive URL. Please use a valid sharing link.' });
    }

    // Create temp filename
    const tempFilename = `drive_${Date.now()}_${fileId}.mp4`;
    const tempPath = path.join(__dirname, '../../storage/uploads', tempFilename);

    try {
      await downloadFile(fileId, tempPath, (progress) => {
        // optional logging
      });
    } catch (err) {
      console.error('Drive download failed:', err.message || err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to download file from Google Drive' });
    }
    
    // Get file stats
    const stats = fs.statSync(tempPath);
    
    // Extract media information
    const mediaInfo = await extractMediaInfo(tempPath);
    
    // Generate thumbnail
    const thumbnailFilename = `thumb_${path.parse(tempFilename).name}.jpg`;
    const thumbnailPath = path.join(process.env.THUMBNAIL_DIR || './storage/thumbnails', thumbnailFilename);
    await createThumbnail(tempPath, thumbnailPath);
    
    // Create content entry with resolution
    const resolution = mediaInfo.width && mediaInfo.height 
      ? `${mediaInfo.width}×${mediaInfo.height}` 
      : null;
      
    const contentData = {
      title: title || 'Imported from Google Drive',
      description: description || 'Video imported from Google Drive',
      filename: tempFilename,
      filepath: tempFilename, // Store only filename
      filesize: stats.size,
      mimetype: 'video/mp4',
      durationSeconds: mediaInfo.durationSeconds,
      thumbnailPath: thumbnailFilename, // Store only filename (e.g., thumb_xxx.jpg)
      resolution: resolution
    };
    
    await Content.createEntry(req.session.accountId, contentData);
    
    await logInfo('Content imported from Drive URL', {
      username: req.session.username,
      filename: tempFilename,
      fileId: fileId
    });
    
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
});

module.exports = router;
