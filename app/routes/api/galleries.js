const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { requireAuth } = require('../../middleware/authGuard');
const {
  getGalleriesByChannel,
  getGalleryByUuid,
  createGallery,
  updateGallery,
  deleteGallery,
  getGalleryVideos
} = require('../../controllers/galleryController');

/**
 * GET /api/galleries/channel/:channelUuid
 * Get all gallery videos for a channel
 */
router.get('/channel/:channelUuid', requireAuth, getGalleriesByChannel);

/**
 * GET /api/galleries/:galleryUuid
 * Get single gallery video by UUID
 */
router.get('/:galleryUuid', requireAuth, getGalleryByUuid);

/**
 * POST /api/galleries
 * Create new gallery video
 */
router.post('/', [
  requireAuth,
  body('channelUuid').trim().notEmpty().withMessage('Channel UUID is required'),
  body('galleryTitle').trim().notEmpty().withMessage('Title is required'),
  body('galleryDescription').optional().trim(),
  body('platformVideoId').optional().trim()
], createGallery);

/**
 * PUT /api/galleries/:galleryUuid
 * Update gallery video
 */
router.put('/:galleryUuid', [
  requireAuth,
  body('galleryTitle').optional().trim().notEmpty(),
  body('galleryDescription').optional().trim(),
  body('status').optional().isIn(['active', 'inactive', 'archived'])
], updateGallery);

/**
 * DELETE /api/galleries/:galleryUuid
 * Delete gallery video
 */
router.delete('/:galleryUuid', requireAuth, deleteGallery);

/**
 * GET /api/galleries/:galleryUuid/videos
 * Get all videos in a gallery
 */
router.get('/:galleryUuid/videos', requireAuth, getGalleryVideos);

module.exports = router;
