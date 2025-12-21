const Project = require('../models/Project');
const User = require('../models/User');
const Channel = require('../models/Channel');
const GalleryVideo = require('../models/GalleryVideo');
const Video = require('../models/Video');
const { logInfo, logError } = require('../services/activityLogger');
const { validationResult } = require('express-validator');

/**
 * Get all projects for current user
 */
const getAllProjects = async (req, res) => {
  try {
    // Get user_uuid from session
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const projects = await Project.getByUser(user.user_uuid);

    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    await logError('Failed to fetch projects', {
      userId: req.session.accountId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects'
    });
  }
};

/**
 * Get single project by UUID
 */
const getProjectByUuid = async (req, res) => {
  try {
    const { projectUuid } = req.params;
    const project = await Project.findByUuid(projectUuid);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify ownership
    const user = await User.findById(req.session.accountId);
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    await logError('Failed to fetch project', {
      projectUuid: req.params.projectUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch project'
    });
  }
};

/**
 * Create new project
 */
const createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { projectName, projectType, projectDescription } = req.body;

    // Validate type is not empty
    if (!projectType || projectType.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Project type is required'
      });
    }

    // Validate description is empty
    let description;
    if (!projectDescription || projectDescription.trim() === '') {
      description = 'New Project';
    } else {
      description = projectDescription.trim();
    }

    // Get user_uuid
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create project
    const result = await Project.createNew(
      user.user_uuid,
      projectName,
      projectType,
      description
    );

    await logInfo("Project created", {
      userId: req.session.accountId,
      projectId: result.projectId,
      projectName: projectName,
      projectType: result.projectType,
      projectDescription: description,
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        projectId: result.projectId,
        projectUuid: result.projectUuid,
        projectType: result.projectType,
        projectDescription: result.projectDescription,
      },
    });
  } catch (error) {
    console.error('Error creating project:', error);
    await logError('Failed to create project', {
      userId: req.session.accountId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create project'
    });
  }
};

/**
 * Update project
 */
const updateProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
      });
    }

    const { projectUuid } = req.params;
    const project = await Project.findByUuid(projectUuid);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Verify ownership
    const user = await User.findById(req.session.accountId);
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Update project
    await Project.updateDetails(project.project_uuid, req.body);

    await logInfo("Project updated", {
      userId: req.session.accountId,
      projectUuid,
    });

    res.json({
      success: true,
      message: "Project updated successfully",
    });
  } catch (error) {
    console.error("Error updating project:", error);
    await logError("Failed to update project", {
      projectUuid: req.params.projectUuid,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      message: "Failed to update project",
    });
  }
};

/**
 * Delete project
 */
const deleteProject = async (req, res) => {
  try {
    const { projectUuid } = req.params;
    const project = await Project.findByUuid(projectUuid);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify ownership
    const user = await User.findById(req.session.accountId);
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check for related data
    const hasRelatedData = async (projectUuid) => {
      const hasChannels = await Channel.exists({ project_uuid: projectUuid });
      const hasGalleries = await GalleryVideo.exists({ project_uuid: projectUuid });
      const hasVideos = await Video.exists({ project_uuid: projectUuid });
      return hasChannels || hasGalleries || hasVideos;
    };

    if (await hasRelatedData(project.project_uuid)) {
      return res.status(400).json({
        success: false,
        message: 'Please delete all related channels, galleries, and videos before deleting the project'
      });
    }

    // Delete project (will cascade delete channels)
    await Project.deleteProject(project.project_uuid);

    await logInfo('Project deleted', {
      userId: req.session.accountId,
      projectUuid
    });

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    await logError('Failed to delete project', {
      projectUuid: req.params.projectUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete project'
    });
  }
};

/**
 * Get project statistics
 */
const getProjectStats = async (req, res) => {
  try {
    const { projectUuid } = req.params;
    const project = await Project.findByUuid(projectUuid);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify ownership
    const user = await User.findById(req.session.accountId);
    if (project.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const stats = await Project.getStats(projectUuid);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    await logError('Failed to fetch project stats', {
      projectUuid: req.params.projectUuid,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch project statistics'
    });
  }
};

module.exports = {
  getAllProjects,
  getProjectByUuid,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats
};