const { executeQuery, fetchOne, fetchAll } = require('../core/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Content Model - manages media content/videos
 */
class Content {
  /**
   * Create new content entry
   */
  static async createEntry(accountId, contentData, status = 'ready') {
    const contentUuid = uuidv4();
    
    const { getCurrentTimestamp } = require('../utils/datetime');

    const sql = `
      INSERT INTO content (
        content_uuid, account_id, title, description, filename, 
        filepath, filesize, mimetype, duration_seconds, thumbnail_path, resolution, status, upload_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      contentUuid,
      accountId,
      contentData.title,
      contentData.description || null,
      contentData.filename,
      contentData.filepath,
      contentData.filesize || null,
      contentData.mimetype || null,
      contentData.durationSeconds || null,
      contentData.thumbnailPath || null,
      contentData.resolution || null,
      status,
      getCurrentTimestamp()
    ];
    
    const result = await executeQuery(sql, params);
    
    console.log('Content created:', {
      contentId: result.lastID,
      title: contentData.title,
      status: status
    });
    
    return { contentId: result.lastID, contentUuid };
  }

  /**
   * Find content by ID
   */
  static async findById(contentId) {
    const sql = `
      SELECT c.*, a.username, a.display_name 
      FROM content c
      LEFT JOIN accounts a ON c.account_id = a.account_id
      WHERE c.content_id = ?
    `;
    return await fetchOne(sql, [contentId]);
  }

  /**
   * Find content by UUID
   */
  static async findByUuid(contentUuid) {
    const sql = `
      SELECT c.*, a.username, a.display_name 
      FROM content c
      LEFT JOIN accounts a ON c.account_id = a.account_id
      WHERE c.content_uuid = ?
    `;
    return await fetchOne(sql, [contentUuid]);
  }

  /**
   * Get all content for an account
   */
  static async getByAccount(accountId, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM content 
      WHERE account_id = ?
      ORDER BY upload_date DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [accountId, limit, offset]);
  }

  /**
   * Get all content (admin view)
   */
  static async getAllContent(limit = 50, offset = 0) {
    const sql = `
      SELECT c.*, a.username, a.display_name 
      FROM content c
      LEFT JOIN accounts a ON c.account_id = a.account_id
      ORDER BY c.upload_date DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchAll(sql, [limit, offset]);
  }

  /**
   * Update content metadata
   */
  static async updateMetadata(contentId, updates) {
    const allowedFields = ['title', 'description', 'status', 'thumbnail_path'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(contentId);
    const sql = `UPDATE content SET ${fields.join(', ')} WHERE content_id = ?`;
    return await executeQuery(sql, values);
  }

  /**
   * Delete content
   */
  static async deleteContent(contentId) {
    const sql = 'DELETE FROM content WHERE content_id = ?';
    return await executeQuery(sql, [contentId]);
  }

  /**
   * Search content by title
   */
  static async searchByTitle(searchTerm, limit = 50) {
    const sql = `
      SELECT c.*, a.username, a.display_name 
      FROM content c
      LEFT JOIN accounts a ON c.account_id = a.account_id
      WHERE c.title LIKE ?
      ORDER BY c.upload_date DESC
      LIMIT ?
    `;
    return await fetchAll(sql, [`%${searchTerm}%`, limit]);
  }

  /**
   * Get content count for account
   */
  static async getCountByAccount(accountId) {
    const sql = 'SELECT COUNT(*) as total FROM content WHERE account_id = ?';
    const result = await fetchOne(sql, [accountId]);
    return result.total;
  }

  /**
   * Get total storage used by account
   */
  static async getStorageUsedByAccount(accountId) {
    const sql = 'SELECT SUM(filesize) as total_size FROM content WHERE account_id = ?';
    const result = await fetchOne(sql, [accountId]);
    return result.total_size || 0;
  }
}

module.exports = Content;
