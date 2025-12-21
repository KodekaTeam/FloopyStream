const Channel = require('../models/Channel');
const Project = require('../models/Project');
const User = require('../models/User');
const UploadTemplate = require('../models/UploadTemplate');
const { logInfo, logError } = require('../services/activityLogger');
const { validationResult } = require('express-validator');

/**
 * Get all channels for current user's projects
 */
const getAllChannels = async (req, res) => {
  try {
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all user's projects
    const projects = await Project.getByUser(user.user_uuid);

    // Get channels for each project
    let allChannels = [];
    for (const project of projects) {
      const channels = await Channel.getByProject(project.project_uuid);
      allChannels = allChannels.concat(channels);
    }

    res.json({
      success: true,
      data: allChannels
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    await logError('Failed to fetch channels', {
      userId: req.session.accountId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch channels'
    });
  }
};

/**
 * Get channels by project UUID
 */
const getChannelsByProject = async (req, res) => {
  try {
    const { projectUuid } = req.params;

    // Verify project exists and user owns it
    const project = await Project.findByUuid(projectUuid);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const channels = await Channel.getByProject(projectUuid);

    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    await logError('Failed to fetch channels', {
      projectUuid: req.params.projectUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch channels'
    });
  }
};

/**
 * Get single channel by UUID
 */
const getChannel = async (req, res) => {
  try {
    const { channelUuid } = req.params;
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Verify ownership through project
    const project = await Project.findByUuid(channel.project_uuid);
    const user = await User.findById(req.session.accountId);

    if (!project || project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error fetching channel:', error);
    await logError('Failed to fetch channel', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch channel'
    });
  }
};

/**
 * Create new channel
 */
const createChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }

  try {
    const { projectUuid, channelPlatform, channelName, externalId } = req.body;

    // Verify project exists and user owns it
    const project = await Project.findByUuid(projectUuid);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Create channel
    const result = await Channel.createNew(
      projectUuid,
      channelName,
      channelPlatform,
      externalId
    );

    await logInfo('Channel created', {
      userId: req.session.accountId,
      channelId: result.channelId,
      channelName,
      platform: channelPlatform
    });

    res.status(201).json({
      success: true,
      message: 'Channel created successfully',
      data: {
        channelId: result.channelId,
        channelUuid: result.channelUuid
      }
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    await logError('Failed to create channel', {
      userId: req.session.accountId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create channel'
    });
  }
};

/**
 * Update channel
 */
const updateChannel = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }

  try {
    const { channelUuid } = req.params;
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Verify ownership through project
    const project = await Project.findByUuid(channel.project_uuid);
    const user = await User.findById(req.session.accountId);

    if (!project || project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update channel - use channel_id (integer) not UUID
    await Channel.updateDetails(channel.channel_id, req.body);

    await logInfo('Channel updated', {
      userId: req.session.accountId,
      channelUuid
    });

    res.json({
      success: true,
      message: 'Channel updated successfully'
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    await logError('Failed to update channel', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update channel'
    });
  }
};

/**
 * Delete channel
 */
const deleteChannel = async (req, res) => {
  try {
    const { channelUuid } = req.params;
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Verify ownership through project
    const project = await Project.findByUuid(channel.project_uuid);
    const user = await User.findById(req.session.accountId);

    if (!project || project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete channel (will cascade delete related data)
    await Channel.deleteChannel(channelUuid);

    await logInfo('Channel deleted', {
      userId: req.session.accountId,
      channelUuid
    });

    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    await logError('Failed to delete channel', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete channel'
    });
  }
};

/**
 * Get channel statistics
 */
const getChannelStats = async (req, res) => {
  try {
    const { channelUuid } = req.params;
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Verify ownership through project
    const project = await Project.findByUuid(channel.project_uuid);
    const user = await User.findById(req.session.accountId);

    if (!project || project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const stats = await Channel.getStats(channelUuid);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    await logError('Failed to fetch channel stats', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch channel statistics'
    });
  }
};

/**
 * Get all upload templates for a channel
 */
const getUploadTemplates = async (req, res) => {
  try {
    const { channelUuid } = req.params;

    // Verify channel exists and user owns it
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const templates = await UploadTemplate.getByChannel(channelUuid);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching upload templates:', error);
    await logError('Failed to fetch upload templates', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch upload templates'
    });
  }
};

/**
 * Get a specific upload template
 */
const getUploadTemplate = async (req, res) => {
  try {
    const { channelUuid, templateUuid } = req.params;
    // console.log('getUploadTemplate called with:', { channelUuid, templateUuid, sessionAccountId: req.session.accountId });

    // Verify channel exists and user owns it
    const channel = await Channel.findByUuid(channelUuid);
    // console.log('Channel found:', channel ? { uuid: channel.channel_uuid, name: channel.channel_name } : 'null');
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    // console.log('User found:', user ? { uuid: user.user_uuid, id: user.account_id } : 'null');
    if (channel.user_uuid !== user.user_uuid) {
      console.log('Access denied: channel owner', channel.user_uuid, 'vs user', user.user_uuid);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find template by UUID
    const template = await UploadTemplate.findByUuid(templateUuid);
    // console.log('Template found:', template ? { uuid: template.template_uuid, name: template.template_name } : 'null');
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Verify template belongs to the channel
    if (template.channel_uuid !== channelUuid) {
      console.log('Template channel mismatch:', template.channel_uuid, 'vs', channelUuid);
      return res.status(403).json({
        success: false,
        message: 'Template does not belong to this channel'
      });
    }

    // console.log('Returning template data successfully');
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching upload template:', error);
    await logError('Failed to fetch upload template', {
      channelUuid: req.params.channelUuid,
      templateUuid: req.params.templateUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch upload template'
    });
  }
};

/**
 * Create a new upload template
 */
const createUploadTemplate = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { channelUuid } = req.params;
    const templateData = req.body;

    // Verify channel exists and user owns it
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Process tags
    let tags = null;
    if (templateData.template_tags) {
      tags = templateData.template_tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    const result = await UploadTemplate.createNew(channelUuid, templateData.template_name, {
      title: templateData.template_title,
      description: templateData.template_description,
      tags: tags,
      license: templateData.template_license,
      category: templateData.template_category,
      languageVideo: templateData.template_language_video,
      languageTitle: templateData.template_language_title,
      languageOption: templateData.template_language_option,
      certificateText: templateData.template_certificate_text,
      comment: templateData.template_comment,
      moderation: templateData.template_moderation,
      visibility: templateData.template_visibility,
      audience: templateData.template_audience,
      thumbnailUrl: templateData.thumbnail_url,
      autoSchedule: templateData.auto_schedule
    });

    res.json({
      success: true,
      message: 'Upload template created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating upload template:', error);
    await logError('Failed to create upload template', {
      channelUuid: req.params.channelUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create upload template'
    });
  }
};

/**
 * Update an upload template
 */
const updateUploadTemplate = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { channelUuid, templateId } = req.params;
    const updates = req.body;

    // Verify channel exists and user owns it
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Verify template exists and belongs to channel
    const template = await UploadTemplate.findById(templateId);
    if (!template || template.channel_uuid !== channelUuid) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Process tags if provided
    if (updates.template_tags) {
      updates.template_tags = updates.template_tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    await UploadTemplate.updateDetails(templateId, updates);

    res.json({
      success: true,
      message: 'Upload template updated successfully'
    });
  } catch (error) {
    console.error('Error updating upload template:', error);
    await logError('Failed to update upload template', {
      templateId: req.params.templateId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update upload template'
    });
  }
};

/**
 * Delete an upload template
 */
const deleteUploadTemplate = async (req, res) => {
  try {
    const { channelUuid, templateId } = req.params;

    // Verify channel exists and user owns it
    const channel = await Channel.findByUuid(channelUuid);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const user = await User.findById(req.session.accountId);
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Verify template exists and belongs to channel
    const template = await UploadTemplate.findById(templateId);
    if (!template || template.channel_uuid !== channelUuid) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    await UploadTemplate.deleteTemplate(templateId);

    res.json({
      success: true,
      message: 'Upload template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting upload template:', error);
    await logError('Failed to delete upload template', {
      templateId: req.params.templateId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete upload template'
    });
  }
};

module.exports = {
  getAllChannels,
  getChannelsByProject,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelStats,
  getUploadTemplates,
  getUploadTemplate,
  createUploadTemplate,
  updateUploadTemplate,
  deleteUploadTemplate
};