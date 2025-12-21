const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const channelController = require('../../controllers/channelController');
const { requireAuth } = require('../../middleware/authGuard');

/**
 * GET /api/channels
 * Get all channels for current user's projects
 */
router.get('/', requireAuth, channelController.getAllChannels);

/**
 * GET /api/channels/project/:projectUuid
 * Get channels by project UUID
 */
router.get('/project/:projectUuid', requireAuth, channelController.getChannelsByProject);

/**
 * GET /api/channels/:channelUuid
 * Get single channel by UUID
 */
router.get('/:channelUuid', requireAuth, channelController.getChannel);

/**
 * POST /api/channels
 * Create new channel
 */
router.post('/', [
  requireAuth,
  body('projectUuid').trim().notEmpty().withMessage('Project UUID is required'),
  body('channelPlatform').isIn(['youtube', 'facebook', 'instagram', 'twitch', 'tiktok']).withMessage('Invalid platform'),
  body('channelName').trim().notEmpty().withMessage('Channel name is required'),
  body('externalId').optional().trim()
], channelController.createChannel);

/**
 * PUT /api/channels/:channelUuid
 * Update channel
 */
router.put('/:channelUuid', [
  requireAuth,
  body('channelName').optional().trim().notEmpty(),
  body('externalId').optional().trim()
], channelController.updateChannel);

/**
 * DELETE /api/channels/:channelUuid
 * Delete channel
 */
router.delete('/:channelUuid', requireAuth, channelController.deleteChannel);

/**
 * GET /api/channels/:channelUuid/stats
 * Get channel statistics
 */
router.get('/:channelUuid/stats', requireAuth, channelController.getChannelStats);

/**
 * GET /api/channels/:channelUuid/upload-templates
 * Get all upload templates for a channel
 */
router.get('/:channelUuid/upload-templates', requireAuth, channelController.getUploadTemplates);

/**
 * GET /api/channels/:channelUuid/upload-templates/:templateUuid
 * Get a specific upload template
 */
router.get('/:channelUuid/upload-templates/:templateUuid', requireAuth, (req, res, next) => {
  // console.log('Route hit: getUploadTemplate', req.params);
  next();
}, channelController.getUploadTemplate);

/**
 * POST /api/channels/:channelUuid/upload-templates
 * Create a new upload template
 */
router.post('/:channelUuid/upload-templates', [
  body('template_name').trim().isLength({ min: 1, max: 100 }).withMessage('Template name is required and must be less than 100 characters'),
  body('template_title').optional().trim().isLength({ max: 100 }).withMessage('Title must be less than 100 characters'),
  body('template_description').optional().trim().isLength({ max: 5000 }).withMessage('Description must be less than 5000 characters'),
  body('template_tags').optional().custom((value) => {
    if (value) {
      try {
        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        return tags.length <= 15; // Max 15 tags
      } catch {
        throw new Error('Invalid tags format');
      }
    }
    return true;
  }),
  body('template_category').optional().isInt({ min: 1, max: 44 }).withMessage('Invalid category'),
  body('template_license').optional().isIn(['youtube', 'creativeCommon']).withMessage('Invalid license'),
  body('template_visibility').optional().isIn(['private', 'unlisted', 'public']).withMessage('Invalid visibility'),
  body('template_audience').optional().isIn(['not_for_kids', 'made_for_kids']).withMessage('Invalid audience'),
  body('template_comment').optional().isIn(['active', 'hold', 'disabled']).withMessage('Invalid comment setting'),
  body('template_moderation').optional().isIn(['none', 'moderate', 'strict']).withMessage('Invalid moderation setting'),
  body('auto_schedule').optional().isBoolean()
], requireAuth, channelController.createUploadTemplate);

/**
 * PUT /api/channels/:channelUuid/upload-templates/:templateId
 * Update an upload template
 */
router.put('/:channelUuid/upload-templates/:templateId', [
  body('template_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Template name must be less than 100 characters'),
  body('template_title').optional().trim().isLength({ max: 100 }).withMessage('Title must be less than 100 characters'),
  body('template_description').optional().trim().isLength({ max: 5000 }).withMessage('Description must be less than 5000 characters'),
  body('template_tags').optional().custom((value) => {
    if (value) {
      try {
        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        return tags.length <= 15;
      } catch {
        throw new Error('Invalid tags format');
      }
    }
    return true;
  }),
  body('template_category').optional().isInt({ min: 1, max: 44 }).withMessage('Invalid category'),
  body('template_license').optional().isIn(['youtube', 'creativeCommon']).withMessage('Invalid license'),
  body('template_visibility').optional().isIn(['private', 'unlisted', 'public']).withMessage('Invalid visibility'),
  body('template_audience').optional().isIn(['not_for_kids', 'made_for_kids']).withMessage('Invalid audience'),
  body('template_comment').optional().isIn(['active', 'hold', 'disabled']).withMessage('Invalid comment setting'),
  body('template_moderation').optional().isIn(['none', 'moderate', 'strict']).withMessage('Invalid moderation setting'),
  body('auto_schedule').optional().isBoolean()
], requireAuth, channelController.updateUploadTemplate);

/**
 * DELETE /api/channels/:channelUuid/upload-templates/:templateId
 * Delete an upload template
 */
router.delete('/:channelUuid/upload-templates/:templateId', requireAuth, channelController.deleteUploadTemplate);

module.exports = router;
