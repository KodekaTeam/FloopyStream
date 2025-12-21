const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const { requireAuth } = require('../../middleware/authGuard');
const { videoUploader, thumbnailUploader, handleUploadError } = require('../../middleware/fileUpload');
const contentController = require('../../controllers/contentController');

// Rate limiting for uploads
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests, please try again later'
});

// ============================================
// UPLOAD CONTENT
// ============================================
router.post('/upload', requireAuth, apiLimiter, videoUploader, handleUploadError, contentController.uploadContent);

// ============================================
// GET CONTENT DETAILS
// ============================================
router.get('/:identifier', requireAuth, contentController.getContent);

// ============================================
// UPDATE CONTENT
// ============================================
router.put('/:identifier', requireAuth, thumbnailUploader, handleUploadError, contentController.updateContent);

// ============================================
// DELETE CONTENT
// ============================================
router.delete('/:identifier', requireAuth, contentController.deleteContent);

// ============================================
// GET CONTENT SELECTOR
// ============================================
router.get('/selector/all', requireAuth, contentController.getContentSelector);

// ============================================
// IMPORT FROM GOOGLE DRIVE
// ============================================
router.post('/drive/import-url', requireAuth, contentController.importFromDrive);

module.exports = router;

// Export helper functions for testing
module.exports.verifyChannelOwnership = contentController.verifyChannelOwnership;
module.exports.getOrCreateUserDefaultChannel = contentController.getOrCreateUserDefaultChannel;
