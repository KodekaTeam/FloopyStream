const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { requireAuth } = require('../../middleware/authGuard');
const {
  getAllProjects,
  getProjectByUuid,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats
} = require('../../controllers/projectController');

/**
 * GET /api/projects
 * Get all projects for current user
 */
router.get('/', requireAuth, getAllProjects);

/**
 * GET /api/projects/:projectUuid
 * Get single project by UUID
 */
router.get('/:projectUuid', requireAuth, getProjectByUuid);

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', [
  requireAuth,
  body('projectName').trim().notEmpty().withMessage('Project name is required'),
  body('projectType').trim().notEmpty().withMessage('Project type is required'),
  body('projectDescription').optional().trim()
], createProject);

/**
 * PUT /api/projects/:projectUuid
 * Update project
 */
router.put(
  "/:projectUuid",
  [
    requireAuth,
    body("projectName").optional().trim().notEmpty(),
    body("projectDescription").optional().trim(),
    body("projectStatus")
      .optional()
      .isIn(["active", "inactive", "banned", "archived"]),
  ],
  updateProject
);

/**
 * DELETE /api/projects/:projectUuid
 * Delete project
 */
router.delete('/:projectUuid', requireAuth, deleteProject);

/**
 * GET /api/projects/:projectUuid/stats
 * Get project statistics
 */
router.get('/:projectUuid/stats', requireAuth, getProjectStats);

module.exports = router;
