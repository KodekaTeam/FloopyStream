const express = require('express');const express = require('express');const express = require('express');const express = require('express');const express = require('express');const express = require('express');

const router = express.Router();

const router = express.Router();

const Playlist = require('../../models/Playlist');

const Video = require('../../models/Video');const Playlist = require('../../models/Playlist');const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');

const { logInfo, logError } = require('../../services/activityLogger');const Video = require('../../models/Video');



const {const { requireAuth } = require('../../middleware/authGuard');const router = express.Router();

  verifyPlaylistOwnership,

  verifyChannelOwnershipconst { logInfo, logError } = require('../../services/activityLogger');

} = require('../helpers/ownershipVerification');

const { verifyPlaylistOwnership, verifyChannelOwnership } = require('../helpers/ownershipVerification');const Playlist = require('../../models/Playlist');

const {

  getPlaylistWithDetails,const { getPlaylistWithDetails, getPlaylistsByChannel, createPlaylistFromData, updatePlaylistFromData, addVideoToPlaylist, removeVideoFromPlaylist, getPlaylistVideos, reorderPlaylistVideos, getPlaylistStats } = require('../helpers/playlistHelpers');

  getPlaylistsByChannel,

  createPlaylistFromData,const Video = require('../../models/Video');const router = express.Router();const router = express.Router();

  updatePlaylistFromData,

  addVideoToPlaylist,router.post('/', requireAuth, async (req, res) => { try { const { channelUuid, playlistName, description, playbackMode = 'sequential' } = req.body; if (!channelUuid || !playlistName || playlistName.trim() === '') { return res.status(400).json({ success: false, message: 'channelUuid and playlistName required' }); } const canAccess = await verifyChannelOwnership(channelUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } const validModes = ['sequential', 'shuffle']; const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential'; const result = await createPlaylistFromData(channelUuid, { playlistName: playlistName.trim(), description: description ? description.trim() : '', playbackMode: mode }); await logInfo('Playlist created', { playlistUuid: result.playlistUuid, channelUuid, username: req.session.username }); res.status(201).json({ success: true, message: 'Playlist created successfully', playlist: { playlistId: result.playlistId, playlistUuid: result.playlistUuid, playlistName, channelUuid, playbackMode: mode } }); } catch (error) { console.error('Playlist create error:', error); await logError('Failed to create playlist', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

  removeVideoFromPlaylist,

  getPlaylistVideos,const { requireAuth } = require('../../middleware/authGuard');

  reorderPlaylistVideos,

  getPlaylistStatsrouter.get('/', requireAuth, async (req, res) => { try { const { channelUuid, limit = 50, offset = 0 } = req.query; if (!channelUuid) { return res.status(400).json({ success: false, message: 'channelUuid required' }); } const canAccess = await verifyChannelOwnership(channelUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } const playlists = await getPlaylistsByChannel(channelUuid, parseInt(limit), parseInt(offset)); res.json({ success: true, playlists, count: playlists.length, channelUuid, limit, offset }); } catch (error) { console.error('Playlists list error:', error); await logError('Failed to list playlists', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

} = require('../helpers/playlistHelpers');

const { logInfo, logError } = require('../../services/activityLogger');const Playlist = require('../../models/Playlist');

// ============================================

// CREATE PLAYLISTrouter.get('/:playlistUuid', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; const playlist = await getPlaylistWithDetails(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } res.json({ success: true, playlist }); } catch (error) { console.error('Playlist fetch error:', error); await logError('Failed to fetch playlist', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

// ============================================

router.post('/', requireAuth, async (req, res) => {

  try {

    const { channelUuid, playlistName, description, playbackMode = 'sequential' } = req.body;router.put('/:playlistUuid', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; const { playlistName, description, playbackMode } = req.body; const playlist = await getPlaylistWithDetails(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } if (!playlistName || playlistName.trim() === '') { return res.status(400).json({ success: false, message: 'Playlist name required' }); } const validModes = ['sequential', 'shuffle']; const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential'; await updatePlaylistFromData(playlistUuid, { playlistName: playlistName.trim(), description: description ? description.trim() : '', playbackMode: mode }); await logInfo('Playlist updated', { playlistUuid, username: req.session.username }); res.json({ success: true, message: 'Playlist updated successfully', playlistUuid, channelUuid: playlist.channel_uuid }); } catch (error) { console.error('Playlist update error:', error); await logError('Failed to update playlist', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });



    if (!channelUuid || !playlistName || playlistName.trim() === '') {// Import Phase 4C helpersconst Video = require('../../models/Video');

      return res.status(400).json({

        success: false,router.delete('/:playlistUuid', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; const playlist = await Playlist.findByUuid(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } await Playlist.deleteByUuid(playlistUuid); await logInfo('Playlist deleted', { playlistUuid, username: req.session.username }); res.json({ success: true, message: 'Playlist deleted successfully', playlistUuid }); } catch (error) { console.error('Playlist delete error:', error); await logError('Failed to delete playlist', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

        message: 'channelUuid and playlistName are required'

      });const {

    }

router.post('/:playlistUuid/videos', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; let { videoUuid } = req.body; const playlist = await getPlaylistWithDetails(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } const videoUuids = Array.isArray(videoUuid) ? videoUuid : [videoUuid]; if (videoUuids.length === 0) { return res.status(400).json({ success: false, message: 'No video UUIDs provided' }); } let addedCount = 0; const failedVideos = []; for (const uuid of videoUuids) { try { const video = await Video.findByUuid(uuid); if (!video) { failedVideos.push({ videoUuid: uuid, reason: 'Not found' }); continue; } const result = await addVideoToPlaylist(playlistUuid, uuid); if (result.success) { addedCount++; } else { failedVideos.push({ videoUuid: uuid, reason: result.error }); } } catch (err) { failedVideos.push({ videoUuid: uuid, reason: err.message }); } } await logInfo('Videos added to playlist', { playlistUuid, addedCount, username: req.session.username }); res.json({ success: addedCount > 0, message: `${addedCount} video(s) added to playlist`, addedCount, failedCount: failedVideos.length, failed: failedVideos.length > 0 ? failedVideos : undefined, playlistUuid, channelUuid: playlist.channel_uuid }); } catch (error) { console.error('Add videos error:', error); await logError('Failed to add videos', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

    const canAccess = await verifyChannelOwnership(channelUuid, req.session.accountId, req.session.userRole);

    if (!canAccess) {  verifyPlaylistOwnership,const { requireAuth } = require('../../middleware/authGuard');

      return res.status(403).json({ success: false, message: 'Access denied to this channel' });

    }router.delete('/:playlistUuid/videos/:videoUuid', requireAuth, async (req, res) => { try { const { playlistUuid, videoUuid } = req.params; const playlist = await getPlaylistWithDetails(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } const result = await removeVideoFromPlaylist(playlistUuid, videoUuid); if (!result.success) { return res.status(404).json({ success: false, message: result.error || 'Video not found' }); } await logInfo('Video removed from playlist', { playlistUuid, videoUuid, username: req.session.username }); res.json({ success: true, message: 'Video removed from playlist', playlistUuid, channelUuid: playlist.channel_uuid }); } catch (error) { console.error('Remove video error:', error); await logError('Failed to remove video', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });



    const validModes = ['sequential', 'shuffle'];  verifyChannelOwnership

    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

router.get('/:playlistUuid/videos', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; const playlist = await Playlist.findByUuid(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } const videos = await getPlaylistVideos(playlistUuid); res.json({ success: true, videos, count: videos.length, playlistUuid }); } catch (error) { console.error('Videos fetch error:', error); await logError('Failed to fetch videos', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

    const result = await createPlaylistFromData(channelUuid, {

      playlistName: playlistName.trim(),} = require('../helpers/ownershipVerification');const { logInfo, logError } = require('../../services/activityLogger');const Playlist = require('../../models/Playlist');const Playlist = require('../../models/Playlist');

      description: description ? description.trim() : '',

      playbackMode: moderouter.put('/:playlistUuid/reorder', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; const { videoOrder } = req.body; if (!Array.isArray(videoOrder) || videoOrder.length === 0) { return res.status(400).json({ success: false, message: 'videoOrder array required' }); } const playlist = await getPlaylistWithDetails(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } await reorderPlaylistVideos(playlistUuid, videoOrder); await logInfo('Playlist reordered', { playlistUuid, videoCount: videoOrder.length, username: req.session.username }); res.json({ success: true, message: 'Playlist reordered successfully', playlistUuid, videoCount: videoOrder.length, channelUuid: playlist.channel_uuid }); } catch (error) { console.error('Reorder error:', error); await logError('Failed to reorder playlist', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

    });

const {

    await logInfo('Playlist created', {

      playlistUuid: result.playlistUuid,router.get('/:playlistUuid/stats', requireAuth, async (req, res) => { try { const { playlistUuid } = req.params; const playlist = await Playlist.findByUuid(playlistUuid); if (!playlist) { return res.status(404).json({ success: false, message: 'Playlist not found' }); } const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole); if (!canAccess) { return res.status(403).json({ success: false, message: 'Access denied' }); } const stats = await getPlaylistStats(playlistUuid); res.json({ success: true, stats, playlistUuid }); } catch (error) { console.error('Stats error:', error); await logError('Failed to get stats', { error: error.message }); res.status(500).json({ success: false, message: error.message }); } });

      channelUuid,

      username: req.session.username  getPlaylistWithDetails,

    });

module.exports = router;

    res.status(201).json({

      success: true,  getPlaylistsByChannel,

      message: 'Playlist created successfully',

      playlist: {  createPlaylistFromData,// Import Phase 4C helpersconst Video = require('../../models/Video');const Content = require('../../models/Content');

        playlist_id: result.playlistId,

        playlist_uuid: result.playlistUuid,  updatePlaylistFromData,

        playlist_name: playlistName,

        channel_uuid: channelUuid,  addVideoToPlaylist,const {

        playback_mode: mode

      }  removeVideoFromPlaylist,

    });

  } catch (error) {  getPlaylistVideos,  verifyPlaylistOwnership,const Channel = require('../../models/Channel');const Video = require('../../models/Video');

    console.error('Playlist create error:', error);

    await logError('Failed to create playlist', { error: error.message });  reorderPlaylistVideos,

    res.status(500).json({ success: false, message: error.message });

  }  getPlaylistStats  verifyChannelOwnership

});

} = require('../helpers/playlistHelpers');

// ============================================

// LIST PLAYLISTS BY CHANNEL} = require('../helpers/ownershipVerification');const Project = require('../../models/Project');const UserAdapter = require('../../models/UserAdapter');

// ============================================

router.get('/', requireAuth, async (req, res) => {// ============================================

  try {

    const { channelUuid, limit = 50, offset = 0 } = req.query;// CREATE PLAYLISTconst {



    if (!channelUuid) {// ============================================

      return res.status(400).json({

        success: false,router.post('/', requireAuth, async (req, res) => {  getPlaylistWithDetails,const User = require('../../models/User');const { requireAuth } = require('../../middleware/authGuard');

        message: 'channelUuid is required'

      });  try {

    }

    const { channelUuid, playlistName, description, playbackMode = 'sequential' } = req.body;  getPlaylistsByChannel,

    const canAccess = await verifyChannelOwnership(channelUuid, req.session.accountId, req.session.userRole);

    if (!canAccess) {

      return res.status(403).json({ success: false, message: 'Access denied to this channel' });

    }    if (!channelUuid || !playlistName || playlistName.trim() === '') {  createPlaylistFromData,const { requireAuth } = require('../../middleware/authGuard');const { logInfo, logError } = require('../../services/activityLogger');



    const playlists = await getPlaylistsByChannel(channelUuid, parseInt(limit), parseInt(offset));      return res.status(400).json({ 



    res.json({        success: false,   updatePlaylistFromData,

      success: true,

      playlists,        message: 'channelUuid and playlistName are required' 

      count: playlists.length,

      channel_uuid: channelUuid,      });  addVideoToPlaylist,const { logInfo, logError } = require('../../services/activityLogger');const { fetchAll } = require('../../core/database');

      limit,

      offset    }

    });

  } catch (error) {  removeVideoFromPlaylist,

    console.error('Playlists list error:', error);

    await logError('Failed to list playlists', { error: error.message });    const canAccess = await verifyChannelOwnership(

    res.status(500).json({ success: false, message: error.message });

  }      channelUuid,  getPlaylistVideos,

});

      req.session.accountId,

// ============================================

// GET PLAYLIST DETAILS      req.session.userRole  reorderPlaylistVideos,

// ============================================

router.get('/:playlistUuid', requireAuth, async (req, res) => {    );

  try {

    const { playlistUuid } = req.params;  getPlaylistStats// Import Phase 4C helpers// ============================================



    const playlist = await getPlaylistWithDetails(playlistUuid);    if (!canAccess) {

    if (!playlist) {

      return res.status(404).json({ success: false, message: 'Playlist not found' });      return res.status(403).json({} = require('../helpers/playlistHelpers');

    }

        success: false,

    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);

    if (!canAccess) {        message: 'Access denied'const {// HELPER: Verify playlist ownership (supports both old and new structure)

      return res.status(403).json({ success: false, message: 'Access denied' });

    }      });



    res.json({ success: true, playlist });    }// ============================================

  } catch (error) {

    console.error('Playlist fetch error:', error);

    await logError('Failed to fetch playlist', { error: error.message });

    res.status(500).json({ success: false, message: error.message });    const validModes = ['sequential', 'shuffle'];// CREATE PLAYLIST  verifyPlaylistOwnership,// ============================================

  }

});    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';



// ============================================// ============================================

// UPDATE PLAYLIST

// ============================================    const result = await createPlaylistFromData(channelUuid, {

router.put('/:playlistUuid', requireAuth, async (req, res) => {

  try {      playlistName: playlistName.trim(),  verifyChannelOwnershipasync function verifyPlaylistOwnership(playlist, userId, userRole) {

    const { playlistUuid } = req.params;

    const { playlistName, description, playbackMode } = req.body;      description: description ? description.trim() : '',



    const playlist = await getPlaylistWithDetails(playlistUuid);      playbackMode: mode/**

    if (!playlist) {

      return res.status(404).json({ success: false, message: 'Playlist not found' });    });

    }

 * POST /api/playlists} = require('../helpers/ownershipVerification');  if (userRole === 'admin') return true;

    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);

    if (!canAccess) {    await logInfo('Playlist created', {

      return res.status(403).json({ success: false, message: 'Access denied' });

    }      playlistUuid: result.playlistUuid, * Create a new playlist



    if (!playlistName || playlistName.trim() === '') {      channelUuid,

      return res.status(400).json({ success: false, message: 'Playlist name is required' });

    }      username: req.session.username * const {  



    const validModes = ['sequential', 'shuffle'];    });

    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

 * Request format (NEW STRUCTURE):

    await updatePlaylistFromData(playlistUuid, {

      playlistName: playlistName.trim(),    res.status(201).json({ 

      description: description ? description.trim() : '',

      playbackMode: mode      success: true,  * {  getPlaylistWithDetails,  // Check account_id (old structure) or user_id (new structure)

    });

      message: 'Playlist created successfully',

    await logInfo('Playlist updated', {

      playlistUuid,      playlist: { *   channelUuid: "uuid-...",

      username: req.session.username

    });        playlistId: result.playlistId,



    res.json({        playlistUuid: result.playlistUuid, *   playlistName: "My Playlist",  getPlaylistsByChannel,  // For new structure with channel_uuid, we need to check through channel -> project -> user

      success: true,

      message: 'Playlist updated successfully',        playlistName,

      playlist_uuid: playlistUuid,

      channel_uuid: playlist.channel_uuid        channelUuid, *   description: "Playlist description",

    });

  } catch (error) {        playbackMode: mode

    console.error('Playlist update error:', error);

    await logError('Failed to update playlist', { error: error.message });      } *   playbackMode: "sequential" (or "shuffle")  createPlaylistFromData,  if (playlist.account_id === userId || playlist.user_id === userId) {

    res.status(500).json({ success: false, message: error.message });

  }    });

});

  } catch (error) { * }

// ============================================

// DELETE PLAYLIST    console.error('Playlist create error:', error);

// ============================================

router.delete('/:playlistUuid', requireAuth, async (req, res) => {    await logError('Failed to create playlist', { error: error.message }); */  updatePlaylistFromData,    return true;

  try {

    const { playlistUuid } = req.params;    res.status(500).json({ 



    const playlist = await Playlist.findByUuid(playlistUuid);      success: false, router.post('/', requireAuth, async (req, res) => {

    if (!playlist) {

      return res.status(404).json({ success: false, message: 'Playlist not found' });      message: error.message 

    }

    });  try {  addVideoToPlaylist,  }

    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);

    if (!canAccess) {  }

      return res.status(403).json({ success: false, message: 'Access denied' });

    }});    const { channelUuid, playlistName, description, playbackMode = 'sequential' } = req.body;



    await Playlist.deleteByUuid(playlistUuid);



    await logInfo('Playlist deleted', {// ============================================  removeVideoFromPlaylist,  

      playlistUuid,

      username: req.session.username// GET PLAYLISTS BY CHANNEL

    });

// ============================================    // Validate required fields

    res.json({

      success: true,router.get('/', requireAuth, async (req, res) => {

      message: 'Playlist deleted successfully',

      playlist_uuid: playlistUuid  try {    if (!channelUuid || !playlistName || playlistName.trim() === '') {  getPlaylistVideos,  // If playlist has channel_uuid, check channel ownership

    });

  } catch (error) {    const { channelUuid, limit = 50, offset = 0 } = req.query;

    console.error('Playlist delete error:', error);

    await logError('Failed to delete playlist', { error: error.message });      return res.status(400).json({ 

    res.status(500).json({ success: false, message: error.message });

  }    if (!channelUuid) {

});

      return res.status(400).json({        success: false,   reorderPlaylistVideos,  if (playlist.channel_uuid) {

// ============================================

// ADD VIDEO(S) TO PLAYLIST        success: false,

// ============================================

router.post('/:playlistUuid/videos', requireAuth, async (req, res) => {        message: 'channelUuid query parameter is required'        message: 'channelUuid and playlistName are required' 

  try {

    const { playlistUuid } = req.params;      });

    let { videoUuid } = req.body;

    }      });  getPlaylistStats    try {

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {

      return res.status(404).json({ success: false, message: 'Playlist not found' });

    }    const canAccess = await verifyChannelOwnership(    }



    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);      channelUuid,

    if (!canAccess) {

      return res.status(403).json({ success: false, message: 'Access denied' });      req.session.accountId,} = require('../helpers/playlistHelpers');      const channel = await fetchAll(

    }

      req.session.userRole

    const videoUuids = Array.isArray(videoUuid) ? videoUuid : [videoUuid];

    if (videoUuids.length === 0) {    );    // Verify channel ownership

      return res.status(400).json({ success: false, message: 'No video UUIDs provided' });

    }



    let addedCount = 0;    if (!canAccess) {    const canAccess = await verifyChannelOwnership(        'SELECT project_uuid FROM channels WHERE channel_uuid = ?',

    const failedVideos = [];

      return res.status(403).json({

    for (const uuid of videoUuids) {

      try {        success: false,      channelUuid,

        const video = await Video.findByUuid(uuid);

        if (!video) {        message: 'Access denied'

          failedVideos.push({ videoUuid: uuid, reason: 'Video not found' });

          continue;      });      req.session.accountId,// ============================================        [playlist.channel_uuid]

        }

    }

        const result = await addVideoToPlaylist(playlistUuid, uuid);

        if (result.success) {      req.session.userRole

          addedCount++;

        } else {    const playlists = await getPlaylistsByChannel(

          failedVideos.push({ videoUuid: uuid, reason: result.error });

        }      channelUuid,    );// CREATE PLAYLIST      );

      } catch (err) {

        failedVideos.push({ videoUuid: uuid, reason: err.message });      parseInt(limit),

      }

    }      parseInt(offset)



    await logInfo('Videos added to playlist', {    );

      playlistUuid,

      addedCount,    if (!canAccess) {// ============================================      

      username: req.session.username

    });    res.json({



    res.json({      success: true,      return res.status(403).json({

      success: addedCount > 0,

      message: `${addedCount} video(s) added to playlist`,      playlists,

      added_count: addedCount,

      failed_count: failedVideos.length,      count: playlists.length,        success: false,      if (channel.length > 0) {

      failed: failedVideos.length > 0 ? failedVideos : undefined,

      playlist_uuid: playlistUuid,      channelUuid,

      channel_uuid: playlist.channel_uuid

    });      limit,        message: 'Access denied. You do not own this channel.'

  } catch (error) {

    console.error('Add videos error:', error);      offset

    await logError('Failed to add videos to playlist', { error: error.message });

    res.status(500).json({ success: false, message: error.message });    });      });/**        const project = await fetchAll(

  }

});  } catch (error) {



// ============================================    console.error('Playlists list error:', error);    }

// REMOVE VIDEO FROM PLAYLIST

// ============================================    await logError('Failed to list playlists', { error: error.message });

router.delete('/:playlistUuid/videos/:videoUuid', requireAuth, async (req, res) => {

  try {    res.status(500).json({  * POST /api/playlists          'SELECT user_uuid FROM projects WHERE project_uuid = ?',

    const { playlistUuid, videoUuid } = req.params;

      success: false, 

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {      message: error.message     // Validate playback mode

      return res.status(404).json({ success: false, message: 'Playlist not found' });

    }    });



    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);  }    const validModes = ['sequential', 'shuffle']; * Create a new playlist          [channel[0].project_uuid]

    if (!canAccess) {

      return res.status(403).json({ success: false, message: 'Access denied' });});

    }

    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

    const result = await removeVideoFromPlaylist(playlistUuid, videoUuid);

    if (!result.success) {// ============================================

      return res.status(404).json({

        success: false,// GET PLAYLIST DETAILS *         );

        message: result.error || 'Video not found in playlist'

      });// ============================================

    }

router.get('/:playlistUuid', requireAuth, async (req, res) => {    // Create playlist using helper

    await logInfo('Video removed from playlist', {

      playlistUuid,  try {

      videoUuid,

      username: req.session.username    const { playlistUuid } = req.params;    const result = await createPlaylistFromData(channelUuid, { * Request format (NEW STRUCTURE):        

    });



    res.json({

      success: true,    const playlist = await getPlaylistWithDetails(playlistUuid);      playlistName: playlistName.trim(),

      message: 'Video removed from playlist',

      playlist_uuid: playlistUuid,    if (!playlist) {

      channel_uuid: playlist.channel_uuid

    });      return res.status(404).json({      description: description ? description.trim() : '', * {        if (project.length > 0) {

  } catch (error) {

    console.error('Remove video error:', error);        success: false,

    await logError('Failed to remove video from playlist', { error: error.message });

    res.status(500).json({ success: false, message: error.message });        message: 'Playlist not found'      playbackMode: mode

  }

});      });



// ============================================    }    }); *   channelUuid: "uuid-...",          const user = await UserAdapter.findById(userId);

// GET PLAYLIST VIDEOS

// ============================================

router.get('/:playlistUuid/videos', requireAuth, async (req, res) => {

  try {    const canAccess = await verifyPlaylistOwnership(

    const { playlistUuid } = req.params;

      playlistUuid,

    const playlist = await Playlist.findByUuid(playlistUuid);

    if (!playlist) {      req.session.accountId,    await logInfo('Playlist created', { *   playlistName: "My Playlist",          return user && user.user_uuid === project[0].user_uuid;

      return res.status(404).json({ success: false, message: 'Playlist not found' });

    }      req.session.userRole



    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);    );      playlistUuid: result.playlistUuid,

    if (!canAccess) {

      return res.status(403).json({ success: false, message: 'Access denied' });

    }

    if (!canAccess) {      channelUuid, *   description: "Playlist description",        }

    const videos = await getPlaylistVideos(playlistUuid);

      return res.status(403).json({

    res.json({

      success: true,        success: false,      playlistName: playlistName.trim(),

      videos,

      count: videos.length,        message: 'Access denied'

      playlist_uuid: playlistUuid

    });      });      playbackMode: mode, *   playbackMode: "sequential" (or "shuffle")      }

  } catch (error) {

    console.error('Videos fetch error:', error);    }

    await logError('Failed to fetch playlist videos', { error: error.message });

    res.status(500).json({ success: false, message: error.message });      username: req.session.username

  }

});    res.json({



// ============================================      success: true,    }); * }    } catch (err) {

// REORDER PLAYLIST VIDEOS

// ============================================      playlist

router.put('/:playlistUuid/reorder', requireAuth, async (req, res) => {

  try {    });

    const { playlistUuid } = req.params;

    const { videoOrder } = req.body;  } catch (error) {



    if (!Array.isArray(videoOrder) || videoOrder.length === 0) {    console.error('Playlist fetch error:', error);    res.status(201).json({  */      console.error('Error checking channel ownership:', err);

      return res.status(400).json({

        success: false,    await logError('Failed to fetch playlist', { error: error.message });

        message: 'videoOrder array is required'

      });    res.status(500).json({       success: true, 

    }

      success: false, 

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {      message: error.message       message: 'Playlist created successfully',router.post('/', requireAuth, async (req, res) => {      return false;

      return res.status(404).json({ success: false, message: 'Playlist not found' });

    }    });



    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);  }      playlist: {

    if (!canAccess) {

      return res.status(403).json({ success: false, message: 'Access denied' });});

    }

        playlistId: result.playlistId,  try {    }

    await reorderPlaylistVideos(playlistUuid, videoOrder);

// ============================================

    await logInfo('Playlist reordered', {

      playlistUuid,// UPDATE PLAYLIST        playlistUuid: result.playlistUuid,

      videoCount: videoOrder.length,

      username: req.session.username// ============================================

    });

router.put('/:playlistUuid', requireAuth, async (req, res) => {        playlistName,    const { channelUuid, playlistName, description, playbackMode = 'sequential' } = req.body;  }

    res.json({

      success: true,  try {

      message: 'Playlist reordered successfully',

      playlist_uuid: playlistUuid,    const { playlistUuid } = req.params;        channelUuid,

      video_count: videoOrder.length,

      channel_uuid: playlist.channel_uuid    const { playlistName, description, playbackMode } = req.body;

    });

  } catch (error) {        playbackMode: mode  

    console.error('Reorder error:', error);

    await logError('Failed to reorder playlist', { error: error.message });    const playlist = await getPlaylistWithDetails(playlistUuid);

    res.status(500).json({ success: false, message: error.message });

  }    if (!playlist) {      }

});

      return res.status(404).json({

// ============================================

// GET PLAYLIST STATISTICS        success: false,    });    // Validate required fields  return false;

// ============================================

router.get('/:playlistUuid/stats', requireAuth, async (req, res) => {        message: 'Playlist not found'

  try {

    const { playlistUuid } = req.params;      });  } catch (error) {



    const playlist = await Playlist.findByUuid(playlistUuid);    }

    if (!playlist) {

      return res.status(404).json({ success: false, message: 'Playlist not found' });    console.error('Playlist create error:', error);    if (!channelUuid || !playlistName || playlistName.trim() === '') {}

    }

    const canAccess = await verifyPlaylistOwnership(

    const canAccess = await verifyPlaylistOwnership(playlistUuid, req.session.accountId, req.session.userRole);

    if (!canAccess) {      playlistUuid,    await logError('Failed to create playlist', { error: error.message });

      return res.status(403).json({ success: false, message: 'Access denied' });

    }      req.session.accountId,



    const stats = await getPlaylistStats(playlistUuid);      req.session.userRole    res.status(500).json({       return res.status(400).json({ 



    res.json({    );

      success: true,

      stats,      success: false, 

      playlist_uuid: playlistUuid

    });    if (!canAccess) {

  } catch (error) {

    console.error('Stats error:', error);      return res.status(403).json({      message: error.message         success: false, // ============================================

    await logError('Failed to get playlist statistics', { error: error.message });

    res.status(500).json({ success: false, message: error.message });        success: false,

  }

});        message: 'Access denied'    });



module.exports = router;      });


    }  }        message: 'channelUuid and playlistName are required' // HELPER: Get video by ID or UUID (supports both Content and Video)



    if (!playlistName || playlistName.trim() === '') {});

      return res.status(400).json({

        success: false,      });// ============================================

        message: 'Playlist name is required'

      });// ============================================

    }

// GET PLAYLISTS BY CHANNEL    }async function getVideoById(videoId) {

    const validModes = ['sequential', 'shuffle'];

    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';// ============================================



    await updatePlaylistFromData(playlistUuid, {  // Try as Video UUID first (new structure)

      playlistName: playlistName.trim(),

      description: description ? description.trim() : '',/**

      playbackMode: mode

    }); * GET /api/playlists    // Verify channel ownership  try {



    await logInfo('Playlist updated', { * List playlists for a channel

      playlistUuid,

      username: req.session.username *     const canAccess = await verifyChannelOwnership(    const video = await Video.findByUuid(videoId);

    });

 * @query {string} channelUuid - Channel UUID (required)

    res.json({

      success: true, * @query {number} limit - Results per page (default: 50)      channelUuid,    if (video) return { data: video, type: 'video' };

      message: 'Playlist updated successfully',

      playlistUuid, * @query {number} offset - Pagination offset (default: 0)

      channelUuid: playlist.channel_uuid

    }); */      req.session.accountId,  } catch (err) {

  } catch (error) {

    console.error('Playlist update error:', error);router.get('/', requireAuth, async (req, res) => {

    await logError('Failed to update playlist', { error: error.message });

    res.status(500).json({   try {      req.session.userRole    // Not a UUID or Video table doesn't exist

      success: false, 

      message: error.message     const { channelUuid, limit = 50, offset = 0 } = req.query;

    });

  }    );  }

});

    if (!channelUuid) {

// ============================================

// DELETE PLAYLIST      return res.status(400).json({  

// ============================================

router.delete('/:playlistUuid', requireAuth, async (req, res) => {        success: false,

  try {

    const { playlistUuid } = req.params;        message: 'channelUuid query parameter is required'    if (!canAccess) {  // Try as Content ID (old structure)



    const playlist = await Playlist.findByUuid(playlistUuid);      });

    if (!playlist) {

      return res.status(404).json({    }      return res.status(403).json({  if (!isNaN(videoId)) {

        success: false,

        message: 'Playlist not found'

      });

    }    // Verify channel ownership        success: false,    const content = await Content.findById(videoId);



    const canAccess = await verifyPlaylistOwnership(    const canAccess = await verifyChannelOwnership(

      playlistUuid,

      req.session.accountId,      channelUuid,        message: 'Access denied. You do not own this channel.'    if (content) return { data: content, type: 'content' };

      req.session.userRole

    );      req.session.accountId,



    if (!canAccess) {      req.session.userRole      });  }

      return res.status(403).json({

        success: false,    );

        message: 'Access denied'

      });    }  

    }

    if (!canAccess) {

    await Playlist.deleteByUuid(playlistUuid);

      return res.status(403).json({  return null;

    await logInfo('Playlist deleted', {

      playlistUuid,        success: false,

      username: req.session.username

    });        message: 'Access denied'    // Validate playback mode}



    res.json({      });

      success: true,

      message: 'Playlist deleted successfully',    }    const validModes = ['sequential', 'shuffle'];

      playlistUuid

    });

  } catch (error) {

    console.error('Playlist delete error:', error);    // Get playlists using helper    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';// ============================================

    await logError('Failed to delete playlist', { error: error.message });

    res.status(500).json({     const playlists = await getPlaylistsByChannel(

      success: false, 

      message: error.message       channelUuid,// CREATE PLAYLIST

    });

  }      parseInt(limit),

});

      parseInt(offset)    // Create playlist using helper// ============================================

// ============================================

// ADD VIDEO TO PLAYLIST    );

// ============================================

router.post('/:playlistUuid/videos', requireAuth, async (req, res) => {    const result = await createPlaylistFromData(channelUuid, {

  try {

    const { playlistUuid } = req.params;    res.json({

    let { videoUuid } = req.body;

      success: true,      playlistName: playlistName.trim(),router.post('/create', requireAuth, async (req, res) => {

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {      playlists,

      return res.status(404).json({

        success: false,      count: playlists.length,      description: description ? description.trim() : '',  try {

        message: 'Playlist not found'

      });      channelUuid,

    }

      limit,      playbackMode: mode    const { name, description, playbackMode } = req.body;

    const canAccess = await verifyPlaylistOwnership(

      playlistUuid,      offset

      req.session.accountId,

      req.session.userRole    });    });

    );

  } catch (error) {

    if (!canAccess) {

      return res.status(403).json({    console.error('Playlists list error:', error);    if (!name || name.trim() === '') {

        success: false,

        message: 'Access denied'    await logError('Failed to list playlists', { error: error.message });

      });

    }    res.status(500).json({     await logInfo('Playlist created', {      return res.status(400).json({ success: false, message: 'Playlist name is required' });



    const videoUuids = Array.isArray(videoUuid) ? videoUuid : [videoUuid];      success: false, 



    if (videoUuids.length === 0) {      message: error.message       playlistUuid: result.playlistUuid,    }

      return res.status(400).json({

        success: false,    });

        message: 'No video UUIDs provided'

      });  }      channelUuid,

    }

});

    let addedCount = 0;

    const failedVideos = [];      playlistName: playlistName.trim(),    // Validate playback mode



    for (const uuid of videoUuids) {// ============================================

      try {

        const video = await Video.findByUuid(uuid);// GET PLAYLIST DETAILS      playbackMode: mode,    const validModes = ['sequential', 'shuffle'];

        if (!video) {

          failedVideos.push({ videoUuid: uuid, reason: 'Not found' });// ============================================

          continue;

        }      username: req.session.username    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';



        const result = await addVideoToPlaylist(playlistUuid, uuid);/**

        if (result.success) {

          addedCount++; * GET /api/playlists/:playlistUuid    });

        } else {

          failedVideos.push({ videoUuid: uuid, reason: result.error }); * Get complete playlist details with videos

        }

      } catch (err) { *     const playlistId = await Playlist.createNew(

        failedVideos.push({ videoUuid: uuid, reason: err.message });

      } * @param {string} playlistUuid - Playlist UUID

    }

 */    res.status(201).json({       req.session.accountId,

    await logInfo('Videos added to playlist', {

      playlistUuid,router.get('/:playlistUuid', requireAuth, async (req, res) => {

      addedCount,

      username: req.session.username  try {      success: true,       name.trim(),

    });

    const { playlistUuid } = req.params;

    res.json({

      success: addedCount > 0,      message: 'Playlist created successfully',      description ? description.trim() : '',

      message: `${addedCount} video(s) added to playlist`,

      addedCount,    // Get playlist with full details

      failedCount: failedVideos.length,

      failed: failedVideos.length > 0 ? failedVideos : undefined,    const playlist = await getPlaylistWithDetails(playlistUuid);      playlist: {      mode

      playlistUuid,

      channelUuid: playlist.channel_uuid    if (!playlist) {

    });

  } catch (error) {      return res.status(404).json({        playlistId: result.playlistId,    );

    console.error('Add videos to playlist error:', error);

    await logError('Failed to add videos to playlist', { error: error.message });        success: false,

    res.status(500).json({ 

      success: false,         message: 'Playlist not found'        playlistUuid: result.playlistUuid,

      message: error.message 

    });      });

  }

});    }        playlistName,    await logInfo('Playlist created', {



// ============================================

// REMOVE VIDEO FROM PLAYLIST

// ============================================    // Verify ownership        channelUuid,      playlistId,

router.delete('/:playlistUuid/videos/:videoUuid', requireAuth, async (req, res) => {

  try {    const canAccess = await verifyPlaylistOwnership(

    const { playlistUuid, videoUuid } = req.params;

      playlistUuid,        playbackMode: mode      name: name.trim(),

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {      req.session.accountId,

      return res.status(404).json({

        success: false,      req.session.userRole      }      playbackMode: mode,

        message: 'Playlist not found'

      });    );

    }

    });      username: req.session.username

    const canAccess = await verifyPlaylistOwnership(

      playlistUuid,    if (!canAccess) {

      req.session.accountId,

      req.session.userRole      return res.status(403).json({  } catch (error) {    });

    );

        success: false,

    if (!canAccess) {

      return res.status(403).json({        message: 'Access denied'    console.error('Playlist create error:', error);

        success: false,

        message: 'Access denied'      });

      });

    }    }    await logError('Failed to create playlist', { error: error.message });    res.json({ success: true, playlistId, message: 'Playlist created successfully' });



    const result = await removeVideoFromPlaylist(playlistUuid, videoUuid);



    if (!result.success) {    res.json({    res.status(500).json({   } catch (error) {

      return res.status(404).json({

        success: false,      success: true,

        message: result.error || 'Video not found in playlist'

      });      playlist      success: false,     console.error('Playlist create error:', error);

    }

    });

    await logInfo('Video removed from playlist', {

      playlistUuid,  } catch (error) {      message: error.message     await logError('Failed to create playlist', { error: error.message });

      videoUuid,

      username: req.session.username    console.error('Playlist fetch error:', error);

    });

    await logError('Failed to fetch playlist', { error: error.message });    });    res.status(500).json({ success: false, message: error.message });

    res.json({

      success: true,    res.status(500).json({ 

      message: 'Video removed from playlist',

      playlistUuid,      success: false,   }  }

      channelUuid: playlist.channel_uuid

    });      message: error.message 

  } catch (error) {

    console.error('Remove video from playlist error:', error);    });});});

    await logError('Failed to remove video from playlist', { error: error.message });

    res.status(500).json({   }

      success: false, 

      message: error.message });

    });

  }

});

// ============================================// ============================================// ============================================

// ============================================

// GET PLAYLIST VIDEOS// UPDATE PLAYLIST

// ============================================

router.get('/:playlistUuid/videos', requireAuth, async (req, res) => {// ============================================// GET PLAYLISTS BY CHANNEL// UPDATE PLAYLIST

  try {

    const { playlistUuid } = req.params;



    const playlist = await Playlist.findByUuid(playlistUuid);/**// ============================================// ============================================

    if (!playlist) {

      return res.status(404).json({ * PUT /api/playlists/:playlistUuid

        success: false,

        message: 'Playlist not found' * Update playlist metadata

      });

    } * 



    const canAccess = await verifyPlaylistOwnership( * @param {string} playlistUuid - Playlist UUID/**router.put('/:id', requireAuth, async (req, res) => {

      playlistUuid,

      req.session.accountId, * @body {string} playlistName - New playlist name

      req.session.userRole

    ); * @body {string} description - New description (optional) * GET /api/playlists  try {



    if (!canAccess) { * @body {string} playbackMode - New playback mode (sequential/shuffle)

      return res.status(403).json({

        success: false, */ * List playlists for a channel    const playlistId = parseInt(req.params.id);

        message: 'Access denied'

      });router.put('/:playlistUuid', requireAuth, async (req, res) => {

    }

  try { *     const { name, description, playbackMode } = req.body;

    const videos = await getPlaylistVideos(playlistUuid);

    const { playlistUuid } = req.params;

    res.json({

      success: true,    const { playlistName, description, playbackMode } = req.body; * @query {string} channelUuid - Channel UUID (required)

      videos,

      count: videos.length,

      playlistUuid

    });    // Get playlist * @query {number} limit - Results per page (default: 50)    const playlist = await Playlist.findById(playlistId);

  } catch (error) {

    console.error('Playlist videos fetch error:', error);    const playlist = await getPlaylistWithDetails(playlistUuid);

    await logError('Failed to fetch playlist videos', { error: error.message });

    res.status(500).json({     if (!playlist) { * @query {number} offset - Pagination offset (default: 0)    if (!playlist) {

      success: false, 

      message: error.message       return res.status(404).json({

    });

  }        success: false, */      return res.status(404).json({ success: false, message: 'Playlist not found' });

});

        message: 'Playlist not found'

// ============================================

// REORDER PLAYLIST VIDEOS      });router.get('/', requireAuth, async (req, res) => {    }

// ============================================

router.put('/:playlistUuid/reorder', requireAuth, async (req, res) => {    }

  try {

    const { playlistUuid } = req.params;  try {

    const { videoOrder } = req.body;

    // Verify ownership

    if (!Array.isArray(videoOrder) || videoOrder.length === 0) {

      return res.status(400).json({    const canAccess = await verifyPlaylistOwnership(    const { channelUuid, limit = 50, offset = 0 } = req.query;    // Check ownership

        success: false,

        message: 'videoOrder array is required'      playlistUuid,

      });

    }      req.session.accountId,    const hasAccess = await verifyPlaylistOwnership(playlist, req.session.accountId, req.session.accountRole); if (!hasAccess) {



    const playlist = await getPlaylistWithDetails(playlistUuid);      req.session.userRole

    if (!playlist) {

      return res.status(404).json({    );    if (!channelUuid) {      return res.status(403).json({ success: false, message: 'Access denied' });

        success: false,

        message: 'Playlist not found'

      });

    }    if (!canAccess) {      return res.status(400).json({    }



    const canAccess = await verifyPlaylistOwnership(      return res.status(403).json({

      playlistUuid,

      req.session.accountId,        success: false,        success: false,

      req.session.userRole

    );        message: 'Access denied'



    if (!canAccess) {      });        message: 'channelUuid query parameter is required'    if (!name || name.trim() === '') {

      return res.status(403).json({

        success: false,    }

        message: 'Access denied'

      });      });      return res.status(400).json({ success: false, message: 'Playlist name is required' });

    }

    // Validate required fields

    await reorderPlaylistVideos(playlistUuid, videoOrder);

    if (!playlistName || playlistName.trim() === '') {    }    }

    await logInfo('Playlist reordered', {

      playlistUuid,      return res.status(400).json({

      videoCount: videoOrder.length,

      username: req.session.username        success: false,

    });

        message: 'Playlist name is required'

    res.json({

      success: true,      });    // Verify channel ownership    // Validate playback mode

      message: 'Playlist videos reordered successfully',

      playlistUuid,    }

      videoCount: videoOrder.length,

      channelUuid: playlist.channel_uuid    const canAccess = await verifyChannelOwnership(    const validModes = ['sequential', 'shuffle'];

    });

  } catch (error) {    // Validate playback mode

    console.error('Playlist reorder error:', error);

    await logError('Failed to reorder playlist', { error: error.message });    const validModes = ['sequential', 'shuffle'];      channelUuid,    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

    res.status(500).json({ 

      success: false,     const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';

      message: error.message 

    });      req.session.accountId,

  }

});    // Update using helper



// ============================================    await updatePlaylistFromData(playlistUuid, {      req.session.userRole    await Playlist.updateDetails(playlistId, name.trim(), description ? description.trim() : '', mode);

// GET PLAYLIST STATISTICS

// ============================================      playlistName: playlistName.trim(),

router.get('/:playlistUuid/stats', requireAuth, async (req, res) => {

  try {      description: description ? description.trim() : '',    );

    const { playlistUuid } = req.params;

      playbackMode: mode

    const playlist = await Playlist.findByUuid(playlistUuid);

    if (!playlist) {    });    await logInfo('Playlist updated', {

      return res.status(404).json({

        success: false,

        message: 'Playlist not found'

      });    await logInfo('Playlist updated', {    if (!canAccess) {      playlistId,

    }

      playlistUuid,

    const canAccess = await verifyPlaylistOwnership(

      playlistUuid,      playlistName: playlistName.trim(),      return res.status(403).json({      name: name.trim(),

      req.session.accountId,

      req.session.userRole      playbackMode: mode,

    );

      username: req.session.username        success: false,      playbackMode: mode,

    if (!canAccess) {

      return res.status(403).json({    });

        success: false,

        message: 'Access denied'        message: 'Access denied'      username: req.session.username

      });

    }    res.json({



    const stats = await getPlaylistStats(playlistUuid);      success: true,      });    });



    res.json({      message: 'Playlist updated successfully',

      success: true,

      stats,      playlistUuid,    }

      playlistUuid

    });      channelUuid: playlist.channel_uuid

  } catch (error) {

    console.error('Playlist stats error:', error);    });    res.json({ success: true, message: 'Playlist updated successfully' });

    await logError('Failed to get playlist stats', { error: error.message });

    res.status(500).json({   } catch (error) {

      success: false, 

      message: error.message     console.error('Playlist update error:', error);    // Get playlists using helper  } catch (error) {

    });

  }    await logError('Failed to update playlist', { error: error.message });

});

    res.status(500).json({     const playlists = await getPlaylistsByChannel(    console.error('Playlist update error:', error);

module.exports = router;

      success: false, 

      message: error.message       channelUuid,    await logError('Failed to update playlist', { error: error.message });

    });

  }      parseInt(limit),    res.status(500).json({ success: false, message: error.message });

});

      parseInt(offset)  }

// ============================================

// DELETE PLAYLIST    );});

// ============================================



/**

 * DELETE /api/playlists/:playlistUuid    res.json({// ============================================

 * Delete a playlist

 *       success: true,// DELETE PLAYLIST

 * @param {string} playlistUuid - Playlist UUID

 */      playlists,// ============================================

router.delete('/:playlistUuid', requireAuth, async (req, res) => {

  try {      count: playlists.length,

    const { playlistUuid } = req.params;

      channelUuid,router.delete('/:id', requireAuth, async (req, res) => {

    // Get playlist

    const playlist = await Playlist.findByUuid(playlistUuid);      limit,  try {

    if (!playlist) {

      return res.status(404).json({      offset    const playlistId = parseInt(req.params.id);

        success: false,

        message: 'Playlist not found'    });

      });

    }  } catch (error) {    const playlist = await Playlist.findById(playlistId);



    // Verify ownership    console.error('Playlists list error:', error);    if (!playlist) {

    const canAccess = await verifyPlaylistOwnership(

      playlistUuid,    await logError('Failed to list playlists', { error: error.message });      return res.status(404).json({ success: false, message: 'Playlist not found' });

      req.session.accountId,

      req.session.userRole    res.status(500).json({     }

    );

      success: false, 

    if (!canAccess) {

      return res.status(403).json({      message: error.message     // Check ownership

        success: false,

        message: 'Access denied'    });    const hasAccess = await verifyPlaylistOwnership(playlist, req.session.accountId, req.session.accountRole); if (!hasAccess) {

      });

    }  }      return res.status(403).json({ success: false, message: 'Access denied' });



    // Delete playlist (cascade to playlist_items)});    }

    await Playlist.deleteByUuid(playlistUuid);



    await logInfo('Playlist deleted', {

      playlistUuid,// ============================================    await Playlist.remove(playlistId);

      playlistName: playlist.playlist_name,

      username: req.session.username// GET PLAYLIST DETAILS

    });

// ============================================    await logInfo('Playlist deleted', {

    res.json({

      success: true,      playlistId,

      message: 'Playlist deleted successfully',

      playlistUuid/**      name: playlist.playlist_name,

    });

  } catch (error) { * GET /api/playlists/:playlistUuid      username: req.session.username

    console.error('Playlist delete error:', error);

    await logError('Failed to delete playlist', { error: error.message }); * Get complete playlist details with videos    });

    res.status(500).json({ 

      success: false,  * 

      message: error.message 

    }); * @param {string} playlistUuid - Playlist UUID    res.json({ success: true, message: 'Playlist deleted successfully' });

  }

}); */  } catch (error) {



// ============================================router.get('/:playlistUuid', requireAuth, async (req, res) => {    console.error('Playlist delete error:', error);

// ADD VIDEO TO PLAYLIST

// ============================================  try {    await logError('Failed to delete playlist', { error: error.message });



/**    const { playlistUuid } = req.params;    res.status(500).json({ success: false, message: error.message });

 * POST /api/playlists/:playlistUuid/videos

 * Add video(s) to playlist  }

 * 

 * @param {string} playlistUuid - Playlist UUID    // Get playlist with full details});

 * @body {string|array} videoUuid - Video UUID or array of UUIDs

 */    const playlist = await getPlaylistWithDetails(playlistUuid);

router.post('/:playlistUuid/videos', requireAuth, async (req, res) => {

  try {    if (!playlist) {// ============================================

    const { playlistUuid } = req.params;

    let { videoUuid } = req.body;      return res.status(404).json({// ADD VIDEOS TO PLAYLIST



    // Get playlist        success: false,// ============================================

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {        message: 'Playlist not found'

      return res.status(404).json({

        success: false,      });router.post('/:id/videos', requireAuth, async (req, res) => {

        message: 'Playlist not found'

      });    }  try {

    }

    const playlistId = parseInt(req.params.id);

    // Verify ownership

    const canAccess = await verifyPlaylistOwnership(    // Verify ownership    const { videoIds } = req.body;

      playlistUuid,

      req.session.accountId,    const canAccess = await verifyPlaylistOwnership(

      req.session.userRole

    );      playlistUuid,    if (!Array.isArray(videoIds) || videoIds.length === 0) {



    if (!canAccess) {      req.session.accountId,      return res.status(400).json({ success: false, message: 'No videos provided' });

      return res.status(403).json({

        success: false,      req.session.userRole    }

        message: 'Access denied'

      });    );

    }

    const playlist = await Playlist.findById(playlistId);

    // Handle single or multiple videos

    const videoUuids = Array.isArray(videoUuid) ? videoUuid : [videoUuid];    if (!canAccess) {    if (!playlist) {



    if (videoUuids.length === 0) {      return res.status(403).json({      return res.status(404).json({ success: false, message: 'Playlist not found' });

      return res.status(400).json({

        success: false,        success: false,    }

        message: 'No video UUIDs provided'

      });        message: 'Access denied'

    }

      });    // Check ownership

    let addedCount = 0;

    const failedVideos = [];    }    const hasAccess = await verifyPlaylistOwnership(playlist, req.session.accountId, req.session.accountRole); if (!hasAccess) {



    for (const uuid of videoUuids) {      return res.status(403).json({ success: false, message: 'Access denied' });

      try {

        // Verify video exists    res.json({    }

        const video = await Video.findByUuid(uuid);

        if (!video) {      success: true,

          failedVideos.push({ videoUuid: uuid, reason: 'Not found' });

          continue;      playlist    // Get current max order

        }

    });    const existingVideos = await Playlist.getVideos(playlistId);

        // Add video to playlist using helper

        const result = await addVideoToPlaylist(playlistUuid, uuid);  } catch (error) {    let maxOrder = existingVideos.length > 0 

        if (result.success) {

          addedCount++;    console.error('Playlist fetch error:', error);      ? Math.max(...existingVideos.map(v => v.order_index))

        } else {

          failedVideos.push({ videoUuid: uuid, reason: result.error });    await logError('Failed to fetch playlist', { error: error.message });      : 0;

        }

      } catch (err) {    res.status(500).json({ 

        failedVideos.push({ videoUuid: uuid, reason: err.message });

      }      success: false,     // Add each video

    }

      message: error.message     let addedCount = 0;

    await logInfo('Videos added to playlist', {

      playlistUuid,    });    for (const videoId of videoIds) {

      addedCount,

      totalAttempted: videoUuids.length,  }      const videoResult = await getVideoById(videoId);

      username: req.session.username

    });});      if (!videoResult) continue;



    res.json({

      success: addedCount > 0,

      message: `${addedCount} video(s) added to playlist`,// ============================================      const { data: videoData, type } = videoResult;

      addedCount,

      failedCount: failedVideos.length,// UPDATE PLAYLIST

      failed: failedVideos.length > 0 ? failedVideos : undefined,

      playlistUuid,// ============================================      // Check video ownership

      channelUuid: playlist.channel_uuid

    });      const videoOwnerId = videoData.account_id || videoData.user_id;

  } catch (error) {

    console.error('Add videos to playlist error:', error);/**      if (videoOwnerId && videoOwnerId !== req.session.accountId) continue;

    await logError('Failed to add videos to playlist', { error: error.message });

    res.status(500).json({  * PUT /api/playlists/:playlistUuid

      success: false, 

      message: error.message  * Update playlist metadata      // Check if already in playlist

    });

  } *       const alreadyInPlaylist = await Playlist.hasVideo(playlistId, videoId);

});

 * @param {string} playlistUuid - Playlist UUID      if (alreadyInPlaylist) continue;

// ============================================

// REMOVE VIDEO FROM PLAYLIST * @body {string} playlistName - New playlist name

// ============================================

 * @body {string} description - New description (optional)      // Add to playlist

/**

 * DELETE /api/playlists/:playlistUuid/videos/:videoUuid * @body {string} playbackMode - New playback mode (sequential/shuffle)      maxOrder++;

 * Remove video from playlist

 *  */      await Playlist.addVideo(playlistId, videoId, maxOrder);

 * @param {string} playlistUuid - Playlist UUID

 * @param {string} videoUuid - Video UUIDrouter.put('/:playlistUuid', requireAuth, async (req, res) => {      addedCount++;

 */

router.delete('/:playlistUuid/videos/:videoUuid', requireAuth, async (req, res) => {  try {    }

  try {

    const { playlistUuid, videoUuid } = req.params;    const { playlistUuid } = req.params;



    // Get playlist    const { playlistName, description, playbackMode } = req.body;    await logInfo('Videos added to playlist', {

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {      playlistId,

      return res.status(404).json({

        success: false,    // Get playlist      addedCount,

        message: 'Playlist not found'

      });    const playlist = await getPlaylistWithDetails(playlistUuid);      username: req.session.username

    }

    if (!playlist) {    });

    // Verify ownership

    const canAccess = await verifyPlaylistOwnership(      return res.status(404).json({

      playlistUuid,

      req.session.accountId,        success: false,    res.json({ 

      req.session.userRole

    );        message: 'Playlist not found'      success: true, 



    if (!canAccess) {      });      message: `${addedCount} video(s) added to playlist`,

      return res.status(403).json({

        success: false,    }      addedCount 

        message: 'Access denied'

      });    });

    }

    // Verify ownership  } catch (error) {

    // Remove video using helper

    const result = await removeVideoFromPlaylist(playlistUuid, videoUuid);    const canAccess = await verifyPlaylistOwnership(    console.error('Add videos to playlist error:', error);



    if (!result.success) {      playlistUuid,    await logError('Failed to add videos to playlist', { error: error.message });

      return res.status(404).json({

        success: false,      req.session.accountId,    res.status(500).json({ success: false, message: error.message });

        message: result.error || 'Video not found in playlist'

      });      req.session.userRole  }

    }

    );});

    await logInfo('Video removed from playlist', {

      playlistUuid,

      videoUuid,

      username: req.session.username    if (!canAccess) {// ============================================

    });

      return res.status(403).json({// MOVE VIDEO IN PLAYLIST

    res.json({

      success: true,        success: false,// ============================================

      message: 'Video removed from playlist',

      playlistUuid,        message: 'Access denied'

      channelUuid: playlist.channel_uuid

    });      });router.put('/:id/videos/:videoId/move', requireAuth, async (req, res) => {

  } catch (error) {

    console.error('Remove video from playlist error:', error);    }  try {

    await logError('Failed to remove video from playlist', { error: error.message });

    res.status(500).json({     const playlistId = parseInt(req.params.id);

      success: false, 

      message: error.message     // Validate required fields    const videoId = parseInt(req.params.videoId);

    });

  }    if (!playlistName || playlistName.trim() === '') {    const { direction } = req.body;

});

      return res.status(400).json({

// ============================================

// GET PLAYLIST VIDEOS        success: false,    if (!direction || !['up', 'down'].includes(direction)) {

// ============================================

        message: 'Playlist name is required'      return res.status(400).json({ success: false, message: 'Invalid direction. Use "up" or "down"' });

/**

 * GET /api/playlists/:playlistUuid/videos      });    }

 * Get all videos in playlist

 *     }

 * @param {string} playlistUuid - Playlist UUID

 */    const playlist = await Playlist.findById(playlistId);

router.get('/:playlistUuid/videos', requireAuth, async (req, res) => {

  try {    // Validate playback mode    if (!playlist) {

    const { playlistUuid } = req.params;

    const validModes = ['sequential', 'shuffle'];      return res.status(404).json({ success: false, message: 'Playlist not found' });

    // Get playlist

    const playlist = await Playlist.findByUuid(playlistUuid);    const mode = validModes.includes(playbackMode) ? playbackMode : 'sequential';    }

    if (!playlist) {

      return res.status(404).json({

        success: false,

        message: 'Playlist not found'    // Update using helper    // Check ownership

      });

    }    await updatePlaylistFromData(playlistUuid, {    const hasAccess = await verifyPlaylistOwnership(playlist, req.session.accountId, req.session.accountRole); if (!hasAccess) {



    // Verify ownership      playlistName: playlistName.trim(),      return res.status(403).json({ success: false, message: 'Access denied' });

    const canAccess = await verifyPlaylistOwnership(

      playlistUuid,      description: description ? description.trim() : '',    }

      req.session.accountId,

      req.session.userRole      playbackMode: mode

    );

    });    const moved = await Playlist.moveVideo(playlistId, videoId, direction);

    if (!canAccess) {

      return res.status(403).json({    

        success: false,

        message: 'Access denied'    await logInfo('Playlist updated', {    if (!moved) {

      });

    }      playlistUuid,      return res.status(400).json({ success: false, message: 'Cannot move video further in that direction' });



    // Get videos using helper      playlistName: playlistName.trim(),    }

    const videos = await getPlaylistVideos(playlistUuid);

      playbackMode: mode,

    res.json({

      success: true,      username: req.session.username    await logInfo('Video moved in playlist', {

      videos,

      count: videos.length,    });      playlistId,

      playlistUuid

    });      videoId,

  } catch (error) {

    console.error('Playlist videos fetch error:', error);    res.json({      direction,

    await logError('Failed to fetch playlist videos', { error: error.message });

    res.status(500).json({       success: true,      username: req.session.username

      success: false, 

      message: error.message       message: 'Playlist updated successfully',    });

    });

  }      playlistUuid,

});

      channelUuid: playlist.channel_uuid    res.json({ success: true, message: `Video moved ${direction}` });

// ============================================

// REORDER PLAYLIST VIDEOS    });  } catch (error) {

// ============================================

  } catch (error) {    console.error('Move video in playlist error:', error);

/**

 * PUT /api/playlists/:playlistUuid/reorder    console.error('Playlist update error:', error);    await logError('Failed to move video in playlist', { error: error.message });

 * Reorder videos in playlist

 *     await logError('Failed to update playlist', { error: error.message });    res.status(500).json({ success: false, message: error.message });

 * @param {string} playlistUuid - Playlist UUID

 * @body {array} videoOrder - Array of video UUIDs in new order    res.status(500).json({   }

 */

router.put('/:playlistUuid/reorder', requireAuth, async (req, res) => {      success: false, });

  try {

    const { playlistUuid } = req.params;      message: error.message 

    const { videoOrder } = req.body;

    });// ============================================

    if (!Array.isArray(videoOrder) || videoOrder.length === 0) {

      return res.status(400).json({  }// REMOVE VIDEO FROM PLAYLIST

        success: false,

        message: 'videoOrder array is required'});// ============================================

      });

    }



    // Get playlist// ============================================router.delete('/:id/videos/:videoId', requireAuth, async (req, res) => {

    const playlist = await getPlaylistWithDetails(playlistUuid);

    if (!playlist) {// DELETE PLAYLIST  try {

      return res.status(404).json({

        success: false,// ============================================    const playlistId = parseInt(req.params.id);

        message: 'Playlist not found'

      });    const videoId = parseInt(req.params.videoId);

    }

/**

    // Verify ownership

    const canAccess = await verifyPlaylistOwnership( * DELETE /api/playlists/:playlistUuid    const playlist = await Playlist.findById(playlistId);

      playlistUuid,

      req.session.accountId, * Delete a playlist    if (!playlist) {

      req.session.userRole

    ); *       return res.status(404).json({ success: false, message: 'Playlist not found' });



    if (!canAccess) { * @param {string} playlistUuid - Playlist UUID    }

      return res.status(403).json({

        success: false, */

        message: 'Access denied'

      });router.delete('/:playlistUuid', requireAuth, async (req, res) => {    // Check ownership

    }

  try {    const hasAccess = await verifyPlaylistOwnership(playlist, req.session.accountId, req.session.accountRole); if (!hasAccess) {

    // Reorder using helper

    await reorderPlaylistVideos(playlistUuid, videoOrder);    const { playlistUuid } = req.params;      return res.status(403).json({ success: false, message: 'Access denied' });



    await logInfo('Playlist reordered', {    }

      playlistUuid,

      videoCount: videoOrder.length,    // Get playlist

      username: req.session.username

    });    const playlist = await Playlist.findByUuid(playlistUuid);    await Playlist.removeVideo(playlistId, videoId);



    res.json({    if (!playlist) {

      success: true,

      message: 'Playlist videos reordered successfully',      return res.status(404).json({    await logInfo('Video removed from playlist', {

      playlistUuid,

      videoCount: videoOrder.length,        success: false,      playlistId,

      channelUuid: playlist.channel_uuid

    });        message: 'Playlist not found'      videoId,

  } catch (error) {

    console.error('Playlist reorder error:', error);      });      username: req.session.username

    await logError('Failed to reorder playlist', { error: error.message });

    res.status(500).json({     }    });

      success: false, 

      message: error.message 

    });

  }    // Verify ownership    res.json({ success: true, message: 'Video removed from playlist' });

});

    const canAccess = await verifyPlaylistOwnership(  } catch (error) {

// ============================================

// GET PLAYLIST STATISTICS      playlistUuid,    console.error('Remove video from playlist error:', error);

// ============================================

      req.session.accountId,    await logError('Failed to remove video from playlist', { error: error.message });

/**

 * GET /api/playlists/:playlistUuid/stats      req.session.userRole    res.status(500).json({ success: false, message: error.message });

 * Get playlist statistics

 *     );  }

 * @param {string} playlistUuid - Playlist UUID

 */});

router.get('/:playlistUuid/stats', requireAuth, async (req, res) => {

  try {    if (!canAccess) {

    const { playlistUuid } = req.params;

      return res.status(403).json({module.exports = router;

    // Get playlist

    const playlist = await Playlist.findByUuid(playlistUuid);        success: false,

    if (!playlist) {        message: 'Access denied'

      return res.status(404).json({      });

        success: false,    }

        message: 'Playlist not found'

      });    // Delete playlist (will cascade delete playlist_items)

    }    await Playlist.deleteByUuid(playlistUuid);



    // Verify ownership    await logInfo('Playlist deleted', {

    const canAccess = await verifyPlaylistOwnership(      playlistUuid,

      playlistUuid,      playlistName: playlist.playlist_name,

      req.session.accountId,      username: req.session.username

      req.session.userRole    });

    );

    res.json({

    if (!canAccess) {      success: true,

      return res.status(403).json({      message: 'Playlist deleted successfully',

        success: false,      playlistUuid

        message: 'Access denied'    });

      });  } catch (error) {

    }    console.error('Playlist delete error:', error);

    await logError('Failed to delete playlist', { error: error.message });

    // Get stats using helper    res.status(500).json({ 

    const stats = await getPlaylistStats(playlistUuid);      success: false, 

      message: error.message 

    res.json({    });

      success: true,  }

      stats,});

      playlistUuid

    });// ============================================

  } catch (error) {// ADD VIDEO TO PLAYLIST

    console.error('Playlist stats error:', error);// ============================================

    await logError('Failed to get playlist stats', { error: error.message });

    res.status(500).json({ /**

      success: false,  * POST /api/playlists/:playlistUuid/videos

      message: error.message  * Add video(s) to playlist

    }); * 

  } * @param {string} playlistUuid - Playlist UUID

}); * @body {string|array} videoUuid - Video UUID or array of UUIDs

 */

module.exports = router;router.post('/:playlistUuid/videos', requireAuth, async (req, res) => {

  try {
    const { playlistUuid } = req.params;
    let { videoUuid } = req.body;

    // Get playlist
    const playlist = await getPlaylistWithDetails(playlistUuid);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    // Verify ownership
    const canAccess = await verifyPlaylistOwnership(
      playlistUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Handle single or multiple videos
    const videoUuids = Array.isArray(videoUuid) ? videoUuid : [videoUuid];

    if (videoUuids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No video UUIDs provided'
      });
    }

    let addedCount = 0;
    const failedVideos = [];

    for (const uuid of videoUuids) {
      try {
        // Verify video exists
        const video = await Video.findByUuid(uuid);
        if (!video) {
          failedVideos.push({ videoUuid: uuid, reason: 'Not found' });
          continue;
        }

        // Add video to playlist using helper
        const result = await addVideoToPlaylist(playlistUuid, uuid);
        if (result.success) {
          addedCount++;
        } else {
          failedVideos.push({ videoUuid: uuid, reason: result.error });
        }
      } catch (err) {
        failedVideos.push({ videoUuid: uuid, reason: err.message });
      }
    }

    await logInfo('Videos added to playlist', {
      playlistUuid,
      addedCount,
      totalAttempted: videoUuids.length,
      username: req.session.username
    });

    res.json({
      success: addedCount > 0,
      message: `${addedCount} video(s) added to playlist`,
      addedCount,
      failedCount: failedVideos.length,
      failed: failedVideos.length > 0 ? failedVideos : undefined,
      playlistUuid,
      channelUuid: playlist.channel_uuid
    });
  } catch (error) {
    console.error('Add videos to playlist error:', error);
    await logError('Failed to add videos to playlist', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// REMOVE VIDEO FROM PLAYLIST
// ============================================

/**
 * DELETE /api/playlists/:playlistUuid/videos/:videoUuid
 * Remove video from playlist
 * 
 * @param {string} playlistUuid - Playlist UUID
 * @param {string} videoUuid - Video UUID
 */
router.delete('/:playlistUuid/videos/:videoUuid', requireAuth, async (req, res) => {
  try {
    const { playlistUuid, videoUuid } = req.params;

    // Get playlist
    const playlist = await getPlaylistWithDetails(playlistUuid);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    // Verify ownership
    const canAccess = await verifyPlaylistOwnership(
      playlistUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Remove video using helper
    const result = await removeVideoFromPlaylist(playlistUuid, videoUuid);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error || 'Video not found in playlist'
      });
    }

    await logInfo('Video removed from playlist', {
      playlistUuid,
      videoUuid,
      username: req.session.username
    });

    res.json({
      success: true,
      message: 'Video removed from playlist',
      playlistUuid,
      channelUuid: playlist.channel_uuid
    });
  } catch (error) {
    console.error('Remove video from playlist error:', error);
    await logError('Failed to remove video from playlist', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// GET PLAYLIST VIDEOS
// ============================================

/**
 * GET /api/playlists/:playlistUuid/videos
 * Get all videos in playlist
 * 
 * @param {string} playlistUuid - Playlist UUID
 */
router.get('/:playlistUuid/videos', requireAuth, async (req, res) => {
  try {
    const { playlistUuid } = req.params;

    // Get playlist
    const playlist = await Playlist.findByUuid(playlistUuid);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    // Verify ownership
    const canAccess = await verifyPlaylistOwnership(
      playlistUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get videos using helper
    const videos = await getPlaylistVideos(playlistUuid);

    res.json({
      success: true,
      videos,
      count: videos.length,
      playlistUuid
    });
  } catch (error) {
    console.error('Playlist videos fetch error:', error);
    await logError('Failed to fetch playlist videos', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// REORDER PLAYLIST VIDEOS
// ============================================

/**
 * PUT /api/playlists/:playlistUuid/reorder
 * Reorder videos in playlist
 * 
 * @param {string} playlistUuid - Playlist UUID
 * @body {array} videoOrder - Array of video UUIDs in new order
 */
router.put('/:playlistUuid/reorder', requireAuth, async (req, res) => {
  try {
    const { playlistUuid } = req.params;
    const { videoOrder } = req.body;

    if (!Array.isArray(videoOrder) || videoOrder.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'videoOrder array is required'
      });
    }

    // Get playlist
    const playlist = await getPlaylistWithDetails(playlistUuid);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    // Verify ownership
    const canAccess = await verifyPlaylistOwnership(
      playlistUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Reorder using helper
    await reorderPlaylistVideos(playlistUuid, videoOrder);

    await logInfo('Playlist reordered', {
      playlistUuid,
      videoCount: videoOrder.length,
      username: req.session.username
    });

    res.json({
      success: true,
      message: 'Playlist videos reordered successfully',
      playlistUuid,
      videoCount: videoOrder.length,
      channelUuid: playlist.channel_uuid
    });
  } catch (error) {
    console.error('Playlist reorder error:', error);
    await logError('Failed to reorder playlist', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ============================================
// GET PLAYLIST STATISTICS
// ============================================

/**
 * GET /api/playlists/:playlistUuid/stats
 * Get playlist statistics
 * 
 * @param {string} playlistUuid - Playlist UUID
 */
router.get('/:playlistUuid/stats', requireAuth, async (req, res) => {
  try {
    const { playlistUuid } = req.params;

    // Get playlist
    const playlist = await Playlist.findByUuid(playlistUuid);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    // Verify ownership
    const canAccess = await verifyPlaylistOwnership(
      playlistUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get stats using helper
    const stats = await getPlaylistStats(playlistUuid);

    res.json({
      success: true,
      stats,
      playlistUuid
    });
  } catch (error) {
    console.error('Playlist stats error:', error);
    await logError('Failed to get playlist stats', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
