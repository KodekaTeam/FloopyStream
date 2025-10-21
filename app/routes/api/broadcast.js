const express = require("express");
const path = require("path");
const router = express.Router();

const Broadcast = require("../../models/Broadcast");
const Content = require("../../models/Content");
const Playlist = require("../../models/Playlist");
const { requireAuth } = require("../../middleware/authGuard");
const {
  startLiveBroadcast,
  startPlaylistBroadcast,
  stopLiveBroadcast,
} = require("../../services/broadcastEngine");
const { logInfo, logError } = require("../../services/activityLogger");
const { executeQuery } = require("../../core/database");

// ============================================
// CREATE BROADCAST
// ============================================

router.post("/start", requireAuth, async (req, res) => {
  try {
    const {
      contentId,
      platformName,
      destinationUrl,
      streamKey,
      scheduledTime,
      broadcastName,
      loopVideo,
      duration,
      bitrate,
      framerate,
      resolution,
      orientation,
    } = req.body;

    // Debug log - check what's received
    console.log("Broadcast start request:", {
      contentId,
      platformName,
      destinationUrl,
      broadcastName,
      scheduledTime,
      loopVideo,
      duration,
    });

    // Validate required fields - only contentId and destinationUrl are truly required now
    if (!contentId || !destinationUrl) {
      console.error("Validation failed:", { contentId, destinationUrl });
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields (contentId and destinationUrl are required)",
      });
    }

    // Check if contentId is a playlist or content
    // contentId format: "playlist-123" or "content-456"
    let content = null;
    let playlist = null;
    let contentType = "content";
    let contentName = "Untitled Broadcast";

    if (contentId.startsWith("playlist-")) {
      // It's a playlist
      const playlistId = parseInt(contentId.replace("playlist-", ""));
      playlist = await Playlist.findById(playlistId);
      if (!playlist) {
        return res
          .status(404)
          .json({ success: false, message: "Playlist not found" });
      }
      contentType = "playlist";
      contentName = playlist.playlist_name;
    } else if (contentId.startsWith("content-")) {
      // It's regular content
      const actualContentId = parseInt(contentId.replace("content-", ""));
      content = await Content.findById(actualContentId);
      if (!content) {
        return res
          .status(404)
          .json({ success: false, message: "Content not found" });
      }
      contentName = content.title;
    } else {
      // Legacy format - assume it's content ID
      content = await Content.findById(parseInt(contentId));
      if (!content) {
        return res
          .status(404)
          .json({ success: false, message: "Content not found" });
      }
      contentName = content.title;
    }

    // Create broadcast record with correct content_id and content_type
    const actualContentId = playlist
      ? playlist.playlist_id
      : content.content_id;

    // Build advanced settings object ONLY if user explicitly enabled Advanced Settings
    const useAdvancedSettingsEnabled =
      req.body.useAdvancedSettingsEnabled === true ||
      req.body.useAdvancedSettingsEnabled === "true";

    let advancedSettings = null;
    if (useAdvancedSettingsEnabled) {
      // User opened Advanced Settings collapse - save settings with flag
      advancedSettings = {
        bitrate: bitrate || "2500k",
        frameRate: framerate || "60",
        resolution: resolution || "480p",
        orientation: orientation || "landscape",
      };
    }
    // If not enabled, advancedSettings stays null - means user didn't explicitly use Advanced Settings

    const broadcastData = {
      contentId: actualContentId,
      contentType: contentType,
      platformName: platformName || "custom", // Default to 'custom' if not specified
      destinationUrl,
      streamKey: streamKey || null,
      scheduledTime: scheduledTime || null,
      broadcastName:
        broadcastName && broadcastName.trim() !== ""
          ? broadcastName.trim()
          : contentName,
      bitrate: bitrate || null,
      frameRate: framerate || null,
      resolution: resolution || null,
      orientation: orientation || null,
      loopvideo: loopVideo === "on" || loopVideo === true || loopVideo === 1,
      durationTimeout: duration ? parseInt(duration) * 60 : null, // Convert minutes to seconds
      advancedSettings: advancedSettings,
    };

    console.log("Broadcast data to be saved:", broadcastData);

    const result = await Broadcast.createNew(
      req.session.accountId,
      broadcastData
    );

    // Don't auto-start, let user manually start the stream
    // Broadcast will be created with status 'offline' (default)

    await logInfo("Broadcast created", {
      broadcastId: result.broadcastId,
      platform: platformName,
      username: req.session.username,
      status: scheduledTime ? "scheduled" : "offline",
    });

    res.json({
      success: true,
      message: scheduledTime
        ? "Broadcast scheduled successfully"
        : 'Broadcast created successfully. Click "Start" to begin streaming.',
      broadcastId: result.broadcastId,
    });
  } catch (error) {
    console.error("Broadcast start error:", error);
    await logError("Failed to start broadcast", { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// MANUALLY START BROADCAST
// ============================================

router.post("/start/:broadcastId", requireAuth, async (req, res) => {
  try {
    const { broadcastId } = req.params;

    // Use new method to detect content type
    const broadcast = await Broadcast.getBroadcastWithContentType(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found" });
    }

    // Check ownership
    if (
      broadcast.account_id !== req.session.accountId &&
      req.session.accountRole !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check if broadcast is already active
    if (broadcast.broadcast_status === "active") {
      return res
        .status(400)
        .json({ success: false, message: "Broadcast is already active" });
    }

    // Check if this is a playlist or regular content
    if (broadcast.content_type === "playlist") {
      // Handle playlist broadcast
      const playlist = await Playlist.findByIdWithVideos(broadcast.content_id);
      if (!playlist || !playlist.videos || playlist.videos.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Playlist is empty or not found" });
      }

      // Check playback mode
      const isShuffleMode = playlist.playback_mode === "shuffle";

      await logInfo("Starting playlist broadcast", {
        broadcastId,
        playlistId: playlist.playlist_id,
        videoCount: playlist.videos.length,
        playbackMode: playlist.playback_mode || "sequential",
        username: req.session.username,
      });

      await startPlaylistBroadcast(
        parseInt(broadcastId),
        playlist.videos,
        broadcast.destination_url,
        broadcast.stream_key,
        isShuffleMode, // shuffle based on playlist playback_mode
        true, // loop - always true for continuous streaming
        {
          bitrate: broadcast.bitrate,
          frame_rate: broadcast.frame_rate,
          resolution: broadcast.resolution,
          orientation: broadcast.orientation,
        }
      );

      res.json({
        success: true,
        message: `Playlist broadcast started with ${
          playlist.videos.length
        } videos (${isShuffleMode ? "Shuffle" : "Sequential"} mode)`,
      });
    } else {
      // Handle regular single content broadcast
      const content = await Content.findById(broadcast.content_id);
      if (!content) {
        return res
          .status(404)
          .json({ success: false, message: "Content not found" });
      }

      // Handle filepath - prefer converted 'stream_<filename>' if it exists
      const fs = require("fs");
      const originalFilename = content.filepath;
      const convertedFilename = `stream_${originalFilename}`;

      // Candidate paths
      const candidateConverted = path.join(
        __dirname,
        "../../storage/uploads",
        convertedFilename
      );
      const candidateOriginal = path.join(
        __dirname,
        "../../storage/uploads",
        originalFilename
      );

      let videoPath;
      if (fs.existsSync(candidateConverted)) {
        videoPath = candidateConverted;
        console.log(
          `Using converted streaming file for broadcast: ${convertedFilename}`
        );
      } else if (fs.existsSync(candidateOriginal)) {
        videoPath = candidateOriginal;
      } else if (
        originalFilename.startsWith("storage/uploads/") ||
        originalFilename.startsWith("storage\\uploads\\")
      ) {
        // Already has prefix stored in DB
        videoPath = path.join(__dirname, "../../", originalFilename);
      } else {
        // Fallback: assume uploads dir
        videoPath = candidateOriginal;
      }

      await startLiveBroadcast(
        parseInt(broadcastId),
        videoPath,
        broadcast.destination_url,
        broadcast.stream_key,
        broadcast.duration_timeout,
        {
          bitrate: broadcast.bitrate,
          frame_rate: broadcast.frame_rate,
          resolution: broadcast.resolution,
          orientation: broadcast.orientation,
        }
      );

      await logInfo("Broadcast started manually", {
        broadcastId,
        username: req.session.username,
      });

      res.json({ success: true, message: "Broadcast started successfully" });
    }
  } catch (error) {
    console.error("Broadcast manual start error:", error);
    await logError("Failed to start broadcast manually", {
      error: error.message,
    });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// STOP BROADCAST
// ============================================

router.post("/stop/:broadcastId", requireAuth, async (req, res) => {
  try {
    const { broadcastId } = req.params;

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found" });
    }

    // Check ownership
    if (
      broadcast.account_id !== req.session.accountId &&
      req.session.accountRole !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await stopLiveBroadcast(parseInt(broadcastId));

    await logInfo("Broadcast stopped", {
      broadcastId,
      username: req.session.username,
    });

    res.json({ success: true, message: "Broadcast stopped" });
  } catch (error) {
    console.error("Broadcast stop error:", error);
    await logError("Failed to stop broadcast", { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET BROADCAST DETAILS
// ============================================

router.get("/:broadcastId", requireAuth, async (req, res) => {
  try {
    const { broadcastId } = req.params;

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found" });
    }

    // Check ownership
    if (
      broadcast.account_id !== req.session.accountId &&
      req.session.accountRole !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, broadcast });
  } catch (error) {
    console.error("Broadcast fetch error:", error);
    await logError("Failed to fetch broadcast", { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// UPDATE BROADCAST
// ============================================

router.put("/:broadcastId", requireAuth, async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const { broadcast_name, destination_url, stream_key } = req.body;

    console.log("Update broadcast request:", {
      broadcastId,
      broadcast_name,
      destination_url,
      stream_key,
    });

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, error: "Broadcast not found" });
    }

    // Check ownership
    if (
      broadcast.account_id !== req.session.accountId &&
      req.session.accountRole !== "admin"
    ) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Validate required fields
    if (!broadcast_name || !destination_url) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Broadcast name and destination URL are required",
        });
    }

    // Update broadcast
    await executeQuery(
      `UPDATE broadcasts 
       SET broadcast_name = ?, destination_url = ?, stream_key = ?
       WHERE broadcast_id = ?`,
      [broadcast_name, destination_url, stream_key || null, broadcastId]
    );

    await logInfo("Broadcast updated", {
      broadcastId,
      broadcast_name,
      username: req.session.username,
    });

    res.json({ success: true, message: "Broadcast updated successfully" });
  } catch (error) {
    console.error("Broadcast update error:", error);
    await logError("Failed to update broadcast", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DELETE BROADCAST
// ============================================

router.delete("/:broadcastId", requireAuth, async (req, res) => {
  try {
    const { broadcastId } = req.params;

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found" });
    }

    // Check ownership
    if (
      broadcast.account_id !== req.session.accountId &&
      req.session.accountRole !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Stop if active
    if (broadcast.broadcast_status === "active") {
      await stopLiveBroadcast(parseInt(broadcastId));
    }

    // Delete record
    await executeQuery("DELETE FROM broadcasts WHERE broadcast_id = ?", [
      broadcastId,
    ]);

    await logInfo("Broadcast deleted", {
      broadcastId,
      username: req.session.username,
    });

    res.json({ success: true, message: "Broadcast deleted successfully" });
  } catch (error) {
    console.error("Broadcast delete error:", error);
    await logError("Failed to delete broadcast", { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
