const express = require('express');
const csrf = require('csrf');
const router = express.Router();

const User = require('../../models/User');
const Project = require('../../models/Project');
const Channel = require('../../models/Channel');
const GalleryVideo = require('../../models/GalleryVideo');
const Video = require('../../models/Video');
const Broadcast = require('../../models/Broadcast');
const Playlist = require('../../models/Playlist');
const { requireAuth, requireAdmin } = require('../../middleware/authGuard');
const { getActiveBroadcastCount } = require('../../services/broadcastEngine');
const { getPlaylistsByChannel } = require('../helpers/playlistHelpers');

const tokens = new csrf();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get user's channels across all projects
 */
async function getUserChannels(userUuid, limit = 100) {
  const sql = `
    SELECT c.*, p.project_name
    FROM channels c
    JOIN projects p ON c.project_uuid = p.project_uuid
    WHERE p.user_uuid = ?
    ORDER BY c.created_at DESC
    LIMIT ?
  `;
  const { fetchAll } = require('../../core/database');
  return await fetchAll(sql, [userUuid, limit]);
}

/**
 * Get recent videos from user's channels
 */
async function getUserVideos(userUuid, limit = 50) {
  const sql = `
    SELECT v.*, g.gallery_title, g.channel_uuid, c.channel_name, p.project_name
    FROM videos v
    JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
    JOIN channels c ON g.channel_uuid = c.channel_uuid
    JOIN projects p ON c.project_uuid = p.project_uuid
    WHERE p.user_uuid = ?
    ORDER BY v.created_at DESC
    LIMIT ?
  `;
  const { fetchAll } = require('../../core/database');
  return await fetchAll(sql, [userUuid, limit]);
}

/**
 * Get user's playlists from their channels
 */
async function getUserPlaylists(userUuid, limit = 50) {
  const sql = `
    SELECT pl.*, c.channel_name, p.project_name
    FROM playlists pl
    JOIN channels c ON pl.channel_uuid = c.channel_uuid
    JOIN projects p ON c.project_uuid = p.project_uuid
    WHERE p.user_uuid = ?
    ORDER BY pl.created_at DESC
    LIMIT ?
  `;
  const { fetchAll } = require('../../core/database');
  return await fetchAll(sql, [userUuid, limit]);
}

/**
 * Get user's broadcasts from their channels
 */
async function getUserBroadcasts(userUuid, limit = 50) {
  const sql = `
    SELECT
      b.*,
      c.channel_name,
      p.project_name,
      v.video_title as content_title,
      v.thumbnail_path,
      pl.playlist_name,
      pl.playback_mode
    FROM broadcasts b
    JOIN channels c ON b.channel_uuid = c.channel_uuid
    JOIN projects p ON c.project_uuid = p.project_uuid
    LEFT JOIN videos v ON b.video_uuid = v.video_uuid AND b.broadcast_type = 'single'
    LEFT JOIN playlists pl ON b.playlist_uuid = pl.playlist_uuid AND b.broadcast_type = 'playlist'
    WHERE p.user_uuid = ?
    ORDER BY b.created_at DESC
    LIMIT ?
  `;
  const { fetchAll } = require('../../core/database');
  const broadcasts = await fetchAll(sql, [userUuid, limit]);

  // Parse advanced_settings JSON and extract resolution, frame_rate, bitrate
  return broadcasts.map(broadcast => {
    let advancedSettings = {};
    try {
      if (broadcast.advanced_settings) {
        advancedSettings = JSON.parse(broadcast.advanced_settings);
      }
    } catch (error) {
      console.warn('Failed to parse advanced_settings for broadcast:', broadcast.broadcast_uuid, error);
    }

    return {
      ...broadcast,
      resolution: advancedSettings.resolution || null,
      frame_rate: advancedSettings.framerate || advancedSettings.frame_rate || null,
      bitrate: advancedSettings.bitrate || null
    };
  });
}

// ============================================
// PAGES - Dashboard
// ============================================

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    // Get user's data through the new hierarchy
    const rawContent = await getUserVideos(user.user_uuid, 10);
    
    // Transform videos to match content structure
    const contentList = rawContent.map(video => ({
      content_id: video.video_uuid, // Use UUID as content_id for compatibility
      title: video.video_title,
      thumbnail_path: video.thumbnail_path,
      duration_seconds: video.duration_seconds,
      filesize: video.filesize,
      resolution: video.resolution,
      upload_date: video.created_at,
      video_uuid: video.video_uuid,
      gallery_title: video.gallery_title,
      channel_uuid: video.channel_uuid,
      channel_name: video.channel_name
    }));
    const playlists = await getUserPlaylists(user.user_uuid);
    const broadcasts = await getUserBroadcasts(user.user_uuid, 50);
    const activeBroadcasts = broadcasts.filter(b => b.broadcast_status === 'active');

    res.render("dashboard/dashboard", {
      title: "Dashboard",
      session: req.session,
      contentList,
      playlists: playlists || [],
      broadcasts,
      activeBroadcasts,
      activeBroadcastCount: getActiveBroadcastCount(),
      currentPage: "dashboard",
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// ============================================
// PAGES - Gallery Detail (must come before general /manage/gallery)
// ============================================

router.get('/gallery/:galleryUuid', requireAuth, async (req, res) => {
  try {
    const { galleryUuid } = req.params;

    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    const gallery = await GalleryVideo.findByUuid(galleryUuid);
    if (!gallery) {
      return res.status(404).send('Gallery not found');
    }

    // Verify ownership
    const channel = await Channel.findByUuid(gallery.channel_uuid);
    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).send('Access denied');
    }

    const videos = await Video.getByGallery(galleryUuid);

    // Transform videos to match content structure for video-grid.ejs
    const contentList = videos.map(video => ({
      content_id: video.video_uuid, // Use UUID as content_id for compatibility
      title: video.video_title,
      thumbnail_path: video.thumbnail_path,
      duration_seconds: video.duration_seconds,
      filesize: video.filesize,
      resolution: video.resolution,
      upload_date: video.created_at,
      video_uuid: video.video_uuid,
      gallery_title: gallery.gallery_title,
      channel_uuid: gallery.channel_uuid,
      channel_name: channel.channel_name
    }));

    res.render("dashboard/manage/gallery/index", {
      title: `${gallery.gallery_title} - Gallery`,
      session: req.session,
      contentList: contentList,
      totalItems: contentList.length,
      currentPage: "Galleries",
      pageSection: "gallery-detail",
      gallery: gallery,
      channelInfo: channel,
    });
  } catch (error) {
    console.error('Gallery detail error:', error);
    res.status(500).send('Error loading gallery');
  }
});

// ============================================
// PAGES - Content Gallery
// ============================================

router.get('/gallery', requireAuth, async (req, res) => {
  try {
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    let allContent = [];
    let channelInfo = null;

    // Check if filtering by channel
    const { channelUuid } = req.query;
    if (channelUuid) {
      // Verify channel ownership
      const channel = await Channel.findByUuid(channelUuid);
      if (!channel || channel.user_uuid !== user.user_uuid) {
        return res.status(403).send('Access denied');
      }

      // Get videos for specific channel
      const sql = `
        SELECT v.*, g.gallery_title, g.channel_uuid, c.channel_name, p.project_name
        FROM videos v
        JOIN gallery_videos g ON v.gallery_uuid = g.gallery_uuid
        JOIN channels c ON g.channel_uuid = c.channel_uuid
        JOIN projects p ON c.project_uuid = p.project_uuid
        WHERE g.channel_uuid = ? AND p.user_uuid = ?
        ORDER BY v.created_at DESC
        LIMIT 1000
      `;
      const { fetchAll } = require('../../core/database');
      allContent = await fetchAll(sql, [channelUuid, user.user_uuid]);
      channelInfo = channel;
    } else {
      // Get ALL content for dynamic client-side pagination
      allContent = await getUserVideos(user.user_uuid, 1000);
    }
    
    // Transform videos to match content structure for video-grid.ejs
    const contentList = allContent.map(video => ({
      content_id: video.video_uuid, // Use UUID as content_id for compatibility
      title: video.video_title,
      thumbnail_path: video.thumbnail_path,
      duration_seconds: video.duration_seconds,
      filesize: video.filesize,
      resolution: video.resolution,
      upload_date: video.created_at,
      video_uuid: video.video_uuid,
      gallery_title: video.gallery_title,
      channel_uuid: video.channel_uuid,
      channel_name: video.channel_name,
      project_name: video.project_name
    }));
    
    console.log('DEBUG [/content route] - User UUID:', user.user_uuid);
    console.log('DEBUG [/content route] - Channel UUID:', channelUuid || 'all');
    console.log('DEBUG [/content route] - Total content retrieved:', allContent.length);
    console.log('DEBUG [/content route] - First few items:', allContent.slice(0, 3).map(c => ({ id: c.video_id, uuid: c.video_uuid, title: c.video_title })));
    
    const totalItems = contentList.length;

    res.render("dashboard/content", {
      title: channelInfo ? `${channelInfo.channel_name} - Video Gallery` : "Video Gallery",
      session: req.session,
      contentList: contentList,  // Send transformed content to client for dynamic pagination
      totalItems: totalItems,
      currentPage: "content",
      pageSection: "content",
      channelInfo: channelInfo, // Pass channel info if filtering
    });
  } catch (error) {
    console.error('Content error:', error);
    res.status(500).send('Error loading content');
  }
});

// ============================================
// PAGES - Broadcast History
// ============================================

router.get('/history', requireAuth, async (req, res) => {
  try {
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    const itemsPerPage = 10;
    const pageNumber = parseInt(req.query.page) || 1;
    
    // Get all broadcasts for user
    const allBroadcasts = await getUserBroadcasts(user.user_uuid, 1000);
    const totalBroadcasts = allBroadcasts.length;
    const totalPages = Math.ceil(totalBroadcasts / itemsPerPage);
    
    // Validate page number
    const validPage = Math.max(1, Math.min(pageNumber, totalPages || 1));
    const offset = (validPage - 1) * itemsPerPage;
    
    // Get paginated broadcasts
    const broadcasts = allBroadcasts.slice(offset, offset + itemsPerPage);

    res.render('dashboard/history/index', {
      title: 'History',
      session: req.session,
      broadcasts,
      pageNumber: validPage,
      totalPages: totalPages,
      totalItems: totalBroadcasts,
      itemsPerPage: itemsPerPage,
      currentPage: 'history'
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).send('Error loading history');
  }
});

// ============================================
// PAGES - Playlists
// ============================================

router.get('/playlists', requireAuth, async (req, res) => {
  try {
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    const playlists = await getUserPlaylists(user.user_uuid);

    res.render("dashboard/manage/playlist/playlists", {
      title: "Playlists",
      session: req.session,
      playlists,
      currentPage: "playlists",
    });
  } catch (error) {
    console.error('Playlists error:', error);
    res.status(500).send('Error loading playlists');
  }
});

// Playlist Detail Page
router.get('/playlists/:playlistUuid', requireAuth, async (req, res) => {
  try {
    const { playlistUuid } = req.params;
    const user = await User.findById(req.session.accountId);
    if (!user) return res.redirect('/login');

    const playlist = await Playlist.findByUuid(playlistUuid);
    if (!playlist) return res.status(404).send('Playlist not found');

    // Check ownership via channel/project
    const channel = await Channel.findByUuid(playlist.channel_uuid);
    if (!channel || channel.user_uuid !== user.user_uuid) {
      return res.status(403).send('Access denied');
    }

    // Get videos in playlist
    const videos = await Playlist.getVideos(playlistUuid);
    // Calculate total duration
    const totalDuration = videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);

    // Get all available videos for this channel (for Add Videos modal)
    const Video = require('../../models/Video');
    const allVideos = await Video.getByChannel(channel.channel_uuid, 1000);

    res.render('dashboard/manage/playlist/playlist-detail', {
      title: playlist.playlist_name,
      session: req.session,
      playlist,
      videos,
      totalDuration,
      allVideos,
      currentPage: 'playlists',
    });
  } catch (error) {
    console.error('Playlist detail error:', error);
    res.status(500).send('Error loading playlist');
  }
});

// ============================================
// PAGES - Projects
// ============================================

router.get('/projects', requireAuth, async (req, res) => {
  try {
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    // Get user's projects with channel count
    const projects = await Project.getByUser(user.user_uuid);

    res.render("dashboard/manage/projects/projects", {
      title: "Projects",
      session: req.session,
      projects,
      currentPage: "projects",
    });
  } catch (error) {
    console.error('Projects error:', error);
    res.status(500).send('Error loading projects');
  }
});

// ============================================
// PAGES - Project Detail (Channels Management)
// ============================================

router.get('/projects/detail/:projectUuid', requireAuth, async (req, res) => {
  try {
    const { projectUuid } = req.params;
    
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    // Get project
    const project = await Project.findByUuid(projectUuid);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    // Check ownership
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).send('Access denied');
    }

    // Get channels for this project
    const channels = await Channel.getByProject(projectUuid);

    res.render("dashboard/manage/projects/project-detail", {
      title: project.project_name,
      session: req.session,
      project,
      channels,
      currentPage: "projects",
    });
  } catch (error) {
    console.error('Project detail error:', error);
    res.status(500).send('Error loading project');
  }
});

// ============================================
// PAGES - Channel Detail (Gallery, Playlists, OAuth)
// ============================================

router.get('/channels/:channelUuid', requireAuth, async (req, res) => {
  try {
    const { channelUuid } = req.params;
    
    // Get current user
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.redirect('/login');
    }

    // Get channel with project info
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).send('Channel not found');
    }

    // Check ownership through project
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).send('Access denied');
    }

    // Get galleries for this channel
    const galleries = await GalleryVideo.getByChannel(channelUuid);
    
    // Get playlists for this channel
    const playlists = await getPlaylistsByChannel(channelUuid);

    // Get OAuth status
    const { fetchAll } = require('../../core/database');
    const oauthSql = `
      SELECT * FROM oauth_credentials 
      WHERE channel_uuid = ?
      LIMIT 1
    `;
    const oauthResults = await fetchAll(oauthSql, [channelUuid]);

    // Get upload templates for this channel
    const UploadTemplate = require('../../models/UploadTemplate');
    const uploadTemplates = await UploadTemplate.getByChannel(channelUuid);

    // Get YouTube data if OAuth exists and platform is YouTube
    let youtubeData = null;
    if (oauthResults.length > 0 && channel.channel_platform === 'youtube') {
      try {
        const youtubeService = require('../../services/youtubeService');
        const analyticsResult = await youtubeService.getChannelAnalytics(oauthResults[0].oauth_uuid);
        if (analyticsResult.success) {
          youtubeData = analyticsResult.data;
        }
      } catch (error) {
        console.error('Error fetching YouTube data:', error);
        // Continue without YouTube data - it's not critical
      }
    }

    res.render("dashboard/manage/channel/channel-detail", {
      title: channel.channel_name,
      session: req.session,
      channel,
      galleries,
      playlists,
      uploadTemplates, // Add upload templates data
      oauth: oauthResults, // Send as array for consistency
      youtubeData, // Add YouTube analytics data
      currentPage: "projects",
    });
  } catch (error) {
    console.error('Channel detail error:', error);
    res.status(500).send('Error loading channel');
  }
});

// ============================================
// PAGES - User Management (Admin)
// ============================================

router.get('/user-management', requireAdmin, async (req, res) => {
  try {
    // Ensure CSRF secret exists
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = tokens.secretSync();
    }
    
    res.render("dashboard/settings/members/user-management", {
      title: "User Management",
      session: req.session,
      currentPage: "user-management",
      csrfToken: tokens.create(req.session.csrfSecret),
    });
  } catch (error) {
    console.error('User management error:', error);
    res.status(500).send('Error loading user management');
  }
});

// ============================================
// PAGES - Settings
// ============================================

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.accountId);
    
    // Ensure CSRF secret exists
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = tokens.secretSync();
    }
    
    // Map user fields to account fields expected by the view
    const account = {
      account_id: user.user_id,
      account_role: user.user_role,
      is_active: user.is_active,
      created_at: user.created_at,
      username: user.user_username,
      email: user.user_email,
      display_name: user.user_fullname
    };
    
    res.render("dashboard/settings/settings", {
      title: "Settings",
      session: req.session,
      userAccount: account,
      currentPage: "settings",
      csrfToken: tokens.create(req.session.csrfSecret),
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).send('Error loading settings');
  }
});

// ============================================
// PAGES - About Us
// ============================================

router.get('/aboutus', requireAuth, async (req, res) => {
  try {
    res.render("dashboard/settings/about/index", {
      title: "About Us",
      session: req.session,
      currentPage: "aboutus",
    });
  } catch (error) {
    console.error('About Us error:', error);
    res.status(500).send('Error loading About Us page');
  }
});

module.exports = router;
