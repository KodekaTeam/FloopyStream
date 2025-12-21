const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authGuard');
const streamkeyController = require('../../controllers/streamkeyController');

// Get all stream keys for a channel
router.get('/channel/:channelUuid', requireAuth, streamkeyController.getStreamKeysByChannel);

// Create new stream key
router.post('/channel/:channelUuid', requireAuth, streamkeyController.createStreamKey);

// Get single stream key by ID
router.get('/:streamKeyId', requireAuth, streamkeyController.getStreamKeyById);

// Update stream key
router.put('/:streamKeyId', requireAuth, streamkeyController.updateStreamKey);

// Delete stream key
router.delete('/:streamKeyId', requireAuth, streamkeyController.deleteStreamKey);

// Sync stream keys from YouTube Studio
router.post('/sync-youtube/:channelUuid', requireAuth, streamkeyController.syncYouTubeStreamKeys);



module.exports = router;