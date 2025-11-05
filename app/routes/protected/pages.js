const express = require("express");
const csrf = require("csrf");
const router = express.Router();

const Account = require("../../models/Account");
const Content = require("../../models/Content");
const Broadcast = require("../../models/Broadcast");
const Playlist = require("../../models/Playlist");
const { requireAuth, requireAdmin } = require("../../middleware/authGuard");
const { getActiveBroadcastCount } = require("../../services/broadcastEngine");

const tokens = new csrf();

// ============================================
// PAGES - Dashboard
// ============================================

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const contentList = await Content.getByAccount(req.session.accountId, 10);
    const playlists = await Playlist.getByAccount(req.session.accountId);
    const broadcasts = await Broadcast.getByAccount(req.session.accountId, 50);
    const activeBroadcasts = broadcasts.filter(
      (b) => b.broadcast_status === "active"
    );

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
    console.error("Dashboard error:", error);
    res.status(500).send("Error loading dashboard");
  }
});

// ============================================
// PAGES - Content Gallery
// ============================================

router.get("/content", requireAuth, async (req, res) => {
  try {
    // Get ALL content for dynamic client-side pagination
    const allContent = await Content.getByAccount(req.session.accountId, 1000);

    console.log('DEBUG [/content route] - Account ID:', req.session.accountId);
    console.log('DEBUG [/content route] - Total content retrieved:', allContent.length);
    console.log('DEBUG [/content route] - First few items:', allContent.slice(0, 3).map(c => ({ id: c.content_id, title: c.title })));

    const totalItems = allContent.length;

    res.render("dashboard/content", {
      title: "Video Gallery",
      session: req.session,
      contentList: allContent,  // Send ALL content to client for dynamic pagination
      totalItems: totalItems,
      currentPage: "content",
      pageSection: "content",
    });
  } catch (error) {
    console.error("Content error:", error);
    res.status(500).send("Error loading content");
  }
});

// ============================================
// PAGES - Broadcast History
// ============================================

router.get("/history", requireAuth, async (req, res) => {
  try {
    const itemsPerPage = 10;
    const pageNumber = parseInt(req.query.page) || 1;
    
    // Get total count of broadcasts
    const totalBroadcasts = await Broadcast.countByAccount(req.session.accountId);
    const totalPages = Math.ceil(totalBroadcasts / itemsPerPage);
    
    // Validate page number
    const validPage = Math.max(1, Math.min(pageNumber, totalPages || 1));
    const offset = (validPage - 1) * itemsPerPage;
    
    // Get paginated broadcasts
    const broadcasts = await Broadcast.getByAccountWithPagination(
      req.session.accountId,
      itemsPerPage,
      offset
    );

    res.render("dashboard/history", {
      title: "History",
      session: req.session,
      broadcasts,
      pageNumber: validPage,
      totalPages: totalPages,
      totalItems: totalBroadcasts,
      itemsPerPage: itemsPerPage,
      currentPage: "history",
    });
  } catch (error) {
    console.error("History error:", error);
    res.status(500).send("Error loading history");
  }
});

// ============================================
// PAGES - Playlists
// ============================================

router.get("/playlists", requireAuth, async (req, res) => {
  try {
    const playlists = await Playlist.getByAccount(req.session.accountId);

    res.render("dashboard/playlist/playlists", {
      title: "Playlists",
      session: req.session,
      playlists,
      currentPage: "playlists",
    });
  } catch (error) {
    console.error("Playlists error:", error);
    res.status(500).send("Error loading playlists");
  }
});

// ============================================
// PAGES - Playlist Detail
// ============================================

router.get("/playlist/:id", requireAuth, async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).send("Playlist not found");
    }

    // Check ownership
    if (playlist.account_id !== req.session.accountId) {
      return res.status(403).send("Access denied");
    }

    // Get videos in playlist
    const videos = await Playlist.getVideos(playlistId);

    // Calculate total duration
    const totalDuration = videos.reduce(
      (sum, video) => sum + (video.duration_seconds || 0),
      0
    );

    // Get all available videos for adding
    const allVideos = await Content.getByAccount(req.session.accountId, 1000);

    res.render("dashboard/playlist/playlist-detail", {
      title: playlist.playlist_name,
      session: req.session,
      playlist,
      videos,
      allVideos,
      totalDuration,
      currentPage: "playlists",
    });
  } catch (error) {
    console.error("Playlist detail error:", error);
    res.status(500).send("Error loading playlist");
  }
});

// ============================================
// PAGES - User Management (Admin)
// ============================================

router.get("/user-management", requireAdmin, async (req, res) => {
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
    console.error("User management error:", error);
    res.status(500).send("Error loading user management");
  }
});

// ============================================
// PAGES - Settings
// ============================================

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const account = await Account.findById(req.session.accountId);

    // Ensure CSRF secret exists
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = tokens.secretSync();
    }

    res.render("dashboard/settings/settings", {
      title: "Settings",
      session: req.session,
      account: account,
      currentPage: "settings",
      csrfToken: tokens.create(req.session.csrfSecret),
    });
  } catch (error) {
    console.error("Settings error:", error);
    res.status(500).send("Error loading settings");
  }
});

// ============================================
// PAGES - About Us
// ============================================

router.get("/aboutus", requireAuth, async (req, res) => {
  try {
    res.render("dashboard/settings/about/index", {
      title: "About Us",
      session: req.session,
      currentPage: "aboutus",
    });
  } catch (error) {
    console.error("About Us error:", error);
    res.status(500).send("Error loading About Us page");
  }
});

module.exports = router;
