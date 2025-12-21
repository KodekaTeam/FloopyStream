const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * Project Model - Manages user projects
 * Projects are grouping/categories that contain multiple channels
 * 
 * Schema:
 * - project_id (PK): Unique identifier
 * - project_uuid (unique): UUID for external references
 * - user_uuid: FK to users table
 * - project_name: Name of the project
 * - description: Project description
 * - type: Project type (e.g., 'channel-youtube', 'channel-tiktok', 'multi')
 * - status: enum('active', 'inactive', 'banned')
 * - created_at, updated_at: Timestamps
 */
class Project {
  /**
   * Create a new project
   * 
   * @param {string} userUuid - User UUID
   * @param {string} projectName - Project name
   * @param {string} projectType - Project type
   * @param {string} projectDescription - Project description (optional)
   * @returns {Promise<Object>} { projectId, projectUuid }
   */
  static async createNew(userUuid, projectName, projectType, projectDescription = null) {
    const projectUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO projects (
        project_uuid, user_uuid, project_name, type, description,
        status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      projectUuid,
      userUuid,
      projectName,
      projectType,
      projectDescription,
      'active',
      now,
      now
    ]);

    console.log(
      `✓ Project created: ${projectName} (ID: ${result.lastID}) |  (Type: ${projectType} |  (projectDescription: ${projectDescription})`
    );
    return { projectId: result.lastID, projectUuid, projectType };
  }

  /**
   * Find project by ID
   * 
   * @param {number} projectId - Project ID
   * @returns {Promise<Object|null>} Project object
   */
  static async findById(projectId) {
    const sql = 'SELECT * FROM projects WHERE project_id = ?';
    return await fetchOne(sql, [projectId]);
  }

  /**
   * Find project by UUID
   * 
   * @param {string} projectUuid - Project UUID
   * @returns {Promise<Object|null>} Project object
   */
  static async findByUuid(projectUuid) {
    const sql = 'SELECT * FROM projects WHERE project_uuid = ?';
    return await fetchOne(sql, [projectUuid]);
  }

  /**
   * Get all projects for a user
   * 
   * @param {string} userUuid - User UUID
   * @param {number} limit - Results limit
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array>} Array of projects
   */
  static async getByUser(userUuid, limit = 50, offset = 0) {
    const sql = `
      SELECT p.*, COUNT(c.channel_id) as channel_count
      FROM projects p
      LEFT JOIN channels c ON p.project_uuid = c.project_uuid
      WHERE p.user_uuid = ?
      GROUP BY p.project_id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [userUuid, limit, offset]);
  }

  /**
   * Get project count for user
   * 
   * @param {string} userUuid - User UUID
   * @returns {Promise<number>} Project count
   */
  static async getCountByUser(userUuid) {
    const sql = 'SELECT COUNT(*) as total FROM projects WHERE user_uuid = ?';
    const result = await fetchOne(sql, [userUuid]);
    return result?.total || 0;
  }

  /**
   * Update project details
   * 
   * @param {string} projectUuid - Project UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateDetails(projectUuid, updates) {
    const allowedFields = ['project_name', 'description', 'type', 'status'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value === '' ? null : value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(getCurrentTimestamp());
    values.push(projectUuid);

    const sql = `UPDATE projects SET ${fields.join(', ')} WHERE project_uuid = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Delete project (and all related channels, galleries, videos)
   * 
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteProject(projectUuid) {
    const sql = 'DELETE FROM projects WHERE project_uuid = ?';
    return await executeQuery(sql, [projectUuid]);
  }

  /**
   * Update project status
   * 
   * @param {number} projectId - Project ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Query result
   */
  static async updateStatus(projectId, status) {
    const validStatuses = ['active', 'inactive', 'banned'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const sql = 'UPDATE projects SET status = ?, updated_at = ? WHERE project_id = ?';
    return await executeQuery(sql, [status, getCurrentTimestamp(), projectId]);
  }

  /**
   * Get project with all channels
   * 
   * @param {number} projectId - Project ID
   * @returns {Promise<Object|null>} Project with channels array
   */
  static async getWithChannels(projectId) {
    const project = await this.findById(projectId);
    if (!project) return null;

    const Channel = require('./Channel');
    project.channels = await Channel.getByProject(project.project_uuid);
    return project;
  }
}

module.exports = Project;
