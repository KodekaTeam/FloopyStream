const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { getCurrentTimestamp } = require('../utils/datetime');

/**
 * UploadTemplate Model - Manages video upload templates per channel
 * Templates store default metadata and settings for video uploads
 * 
 * Schema:
 * - template_id (PK): Unique identifier
 * - template_uuid (unique): UUID for external references
 * - channel_uuid: FK to channels table
 * - template_name: Name of the template
 * - template_title: Default video title
 * - template_description: Default description
 * - template_tags: Default tags (JSON array)
 * - template_license: Default license
 * - template_category: Default category
 * - template_language_video: Video language
 * - template_language_title: Title/description language
 * - template_language_option: UI language preference
 * - template_certificate_text: Certificate/watermark text
 * - template_comment: Comment setting
 * - template_moderation: Moderation level
 * - template_visibility: Video visibility
 * - template_audience: Audience type (COPPA compliance)
 * - thumbnail_url: Default thumbnail URL
 * - auto_schedule: Whether to auto-schedule uploads
 * - created_at, updated_at: Timestamps
 */
class UploadTemplate {
  /**
   * Create a new upload template
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {string} templateName - Template name
   * @param {Object} templateData - Template configuration
   * @returns {Promise<Object>} { templateId, templateUuid }
   */
  static async createNew(channelUuid, templateName, templateData = {}) {
    const templateUuid = uuidv4();
    const now = getCurrentTimestamp();

    const sql = `
      INSERT INTO upload_templates (
        template_uuid, channel_uuid, template_name, template_title,
        template_description, template_tags, template_license,
        template_category, template_language_video, template_language_title,
        template_language_option, template_certificate_text, template_comment,
        template_moderation, template_visibility, template_audience,
        thumbnail_url, auto_schedule, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(sql, [
      templateUuid,
      channelUuid,
      templateName,
      templateData.title || null,
      templateData.description || null,
      templateData.tags ? JSON.stringify(templateData.tags) : null,
      templateData.license || null,
      templateData.category || null,
      templateData.languageVideo || null,
      templateData.languageTitle || null,
      templateData.languageOption || null,
      templateData.certificateText || null,
      templateData.comment || 'active',
      templateData.moderation || 'none',
      templateData.visibility || 'private',
      templateData.audience || 'not_for_kids',
      templateData.thumbnailUrl || null,
      templateData.autoSchedule ? 1 : 0,
      now,
      now
    ]);

    console.log(`✓ Upload template created: ${templateName}`);
    return { templateId: result.lastID, templateUuid };
  }

  /**
   * Find template by ID
   * 
   * @param {number} templateId - Template ID
   * @returns {Promise<Object|null>} Template object with parsed tags
   */
  static async findById(templateId) {
    const sql = `
      SELECT t.*, c.channel_name
      FROM upload_templates t
      LEFT JOIN channels c ON t.channel_uuid = c.channel_uuid
      WHERE t.template_id = ?
    `;
    const template = await fetchOne(sql, [templateId]);
    if (template && template.template_tags) {
      template.template_tags = JSON.parse(template.template_tags);
    }
    return template;
  }

  /**
   * Find template by UUID
   * 
   * @param {string} templateUuid - Template UUID
   * @returns {Promise<Object|null>} Template object with parsed tags
   */
  static async findByUuid(templateUuid) {
    const sql = `
      SELECT t.*, c.channel_name
      FROM upload_templates t
      LEFT JOIN channels c ON t.channel_uuid = c.channel_uuid
      WHERE t.template_uuid = ?
    `;
    const template = await fetchOne(sql, [templateUuid]);
    if (template && template.template_tags) {
      template.template_tags = JSON.parse(template.template_tags);
    }
    return template;
  }

  /**
   * Get all templates for a channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of templates with parsed tags
   */
  static async getByChannel(channelUuid, limit = 50) {
    const sql = `
      SELECT * FROM upload_templates
      WHERE channel_uuid = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const templates = await fetchAll(sql, [channelUuid, limit]);
    return templates.map(t => {
      if (t.template_tags) {
        t.template_tags = JSON.parse(t.template_tags);
      }
      return t;
    });
  }

  /**
   * Get template count for channel
   * 
   * @param {string} channelUuid - Channel UUID
   * @returns {Promise<number>} Template count
   */
  static async getCountByChannel(channelUuid) {
    const sql = 'SELECT COUNT(*) as total FROM upload_templates WHERE channel_uuid = ?';
    const result = await fetchOne(sql, [channelUuid]);
    return result?.total || 0;
  }

  /**
   * Update template details
   * 
   * @param {number} templateId - Template ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Query result
   */
  static async updateDetails(templateId, updates) {
    const allowedFields = [
      'template_name',
      'template_title',
      'template_description',
      'template_tags',
      'template_license',
      'template_category',
      'template_language_video',
      'template_language_title',
      'template_language_option',
      'template_certificate_text',
      'template_comment',
      'template_moderation',
      'template_visibility',
      'template_audience',
      'thumbnail_url',
      'auto_schedule'
    ];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'template_tags' && Array.isArray(value)) {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else if (key === 'auto_schedule') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(getCurrentTimestamp());
    values.push(templateId);

    const sql = `UPDATE upload_templates SET ${fields.join(', ')} WHERE template_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Delete template
   * 
   * @param {number} templateId - Template ID
   * @returns {Promise<Object>} Query result
   */
  static async deleteTemplate(templateId) {
    const sql = 'DELETE FROM upload_templates WHERE template_id = ?';
    return await executeQuery(sql, [templateId]);
  }

  /**
   * Duplicate template
   * 
   * @param {number} templateId - Template ID to duplicate
   * @param {string} newName - Name for duplicated template
   * @returns {Promise<Object>} { templateId, templateUuid } of new template
   */
  static async duplicate(templateId, newName) {
    const original = await this.findById(templateId);
    if (!original) throw new Error('Template not found');

    return await this.createNew(original.channel_uuid, newName, {
      title: original.template_title,
      description: original.template_description,
      tags: original.template_tags,
      license: original.template_license,
      category: original.template_category,
      languageVideo: original.template_language_video,
      languageTitle: original.template_language_title,
      languageOption: original.template_language_option,
      certificateText: original.template_certificate_text,
      comment: original.template_comment,
      moderation: original.template_moderation,
      visibility: original.template_visibility,
      audience: original.template_audience,
      thumbnailUrl: original.thumbnail_url,
      autoSchedule: original.auto_schedule
    });
  }

  /**
   * Get templates with auto-schedule enabled
   * 
   * @param {string} channelUuid - Channel UUID (optional)
   * @returns {Promise<Array>} Array of auto-schedule templates
   */
  static async getAutoScheduleTemplates(channelUuid = null) {
    let sql = 'SELECT * FROM upload_templates WHERE auto_schedule = 1';
    const params = [];

    if (channelUuid) {
      sql += ' AND channel_uuid = ?';
      params.push(channelUuid);
    }

    sql += ' ORDER BY created_at DESC';
    return await fetchAll(sql, params);
  }

  /**
   * Search templates by name
   * 
   * @param {string} searchTerm - Search term
   * @param {string} channelUuid - Filter by channel (optional)
   * @param {number} limit - Results limit
   * @returns {Promise<Array>} Array of matching templates
   */
  static async searchByName(searchTerm, channelUuid = null, limit = 50) {
    let sql = `
      SELECT * FROM upload_templates
      WHERE template_name LIKE ?
    `;
    const params = [`%${searchTerm}%`];

    if (channelUuid) {
      sql += ' AND channel_uuid = ?';
      params.push(channelUuid);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const templates = await fetchAll(sql, params);
    return templates.map(t => {
      if (t.template_tags) {
        t.template_tags = JSON.parse(t.template_tags);
      }
      return t;
    });
  }

  /**
   * Get templates by visibility
   * 
   * @param {string} visibility - Visibility setting
   * @param {string} channelUuid - Filter by channel (optional)
   * @returns {Promise<Array>} Array of templates
   */
  static async getByVisibility(visibility, channelUuid = null) {
    let sql = 'SELECT * FROM upload_templates WHERE template_visibility = ?';
    const params = [visibility];

    if (channelUuid) {
      sql += ' AND channel_uuid = ?';
      params.push(channelUuid);
    }

    sql += ' ORDER BY created_at DESC';
    return await fetchAll(sql, params);
  }
}

module.exports = UploadTemplate;
