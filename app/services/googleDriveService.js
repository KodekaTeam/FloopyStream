const { google } = require('googleapis');
const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../core/database');

/**
 * Google Drive Service for FLoopyStream
 * Handles OAuth2 authentication and file operations
 */

class GoogleDriveService {
  constructor() {
    this.oauth2Client = null;
    this.drive = null;
    this.initialized = false;
  }

  /**
   * Initialize OAuth2 client
   */
  initializeOAuth() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn('⊗ Google Drive: Missing credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
      return false;
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/drive/callback';

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    this.initialized = true;
    return true;
  }

  /**
   * Get authorization URL
   */
  getAuthUrl() {
    if (!this.initialized) {
      if (!this.initializeOAuth()) {
        throw new Error('Google Drive not configured');
      }
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code, accountId) {
    if (!this.initialized) {
      throw new Error('OAuth not initialized');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    
    // Save tokens to database
    await executeQuery(
      `INSERT OR REPLACE INTO google_drive_tokens (account_id, access_token, refresh_token, expires_at) 
       VALUES (?, ?, ?, datetime('now', '+' || ? || ' seconds'))`,
      [accountId, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600]
    );

    return tokens;
  }

  /**
   * Get tokens for account
   */
  async getTokens(accountId) {
    const result = await executeQuery(
      'SELECT * FROM google_drive_tokens WHERE account_id = ? AND expires_at > datetime("now")',
      [accountId]
    );

    return result[0] || null;
  }

  /**
   * Set credentials for account
   */
  async setCredentials(accountId) {
    if (!this.initialized) {
      if (!this.initializeOAuth()) {
        throw new Error('Google Drive not configured');
      }
    }

    const tokens = await this.getTokens(accountId);
    if (!tokens) {
      return false;
    }

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    return true;
  }

  /**
   * List files from Google Drive
   */
  async listFiles(accountId, options = {}) {
    const hasCredentials = await this.setCredentials(accountId);
    if (!hasCredentials) {
      throw new Error('Not authenticated with Google Drive');
    }

    const { mimeType, pageSize = 50, pageToken } = options;

    const query = [];
    if (mimeType === 'video') {
      query.push("mimeType contains 'video/'");
    }
    query.push("trashed = false");

    const response = await this.drive.files.list({
      pageSize,
      pageToken,
      q: query.join(' and '),
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, iconLink, thumbnailLink)',
      orderBy: 'modifiedTime desc'
    });

    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken
    };
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(accountId, fileId) {
    const hasCredentials = await this.setCredentials(accountId);
    if (!hasCredentials) {
      throw new Error('Not authenticated with Google Drive');
    }

    const response = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink'
    });

    return response.data;
  }

  /**
   * Download file from Google Drive
   */
  async downloadFile(accountId, fileId, destinationPath) {
    const hasCredentials = await this.setCredentials(accountId);
    if (!hasCredentials) {
      throw new Error('Not authenticated with Google Drive');
    }

    const dest = fs.createWriteStream(destinationPath);

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          console.log(`✓ Downloaded file from Drive: ${fileId}`);
          resolve(destinationPath);
        })
        .on('error', err => {
          console.error('✗ Download error:', err);
          reject(err);
        })
        .pipe(dest);
    });
  }

  /**
   * Import file from Google Drive to local storage
   */
  async importFile(accountId, fileId) {
    try {
      // Get file metadata
      const metadata = await this.getFileMetadata(accountId, fileId);
      
      // Create unique filename
      const ext = path.extname(metadata.name);
      const basename = path.basename(metadata.name, ext);
      const uniqueName = `${basename}_${Date.now()}${ext}`;
      
      // Download to temp location
      const videoDir = path.join(__dirname, '..', 'storage', 'videos');
      await fs.ensureDir(videoDir);
      
      const destinationPath = path.join(videoDir, uniqueName);
      await this.downloadFile(accountId, fileId, destinationPath);

      return {
        filename: uniqueName,
        filepath: destinationPath,
        originalName: metadata.name,
        filesize: parseInt(metadata.size),
        mimeType: metadata.mimeType
      };
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  }

  /**
   * Disconnect Google Drive for account
   */
  async disconnect(accountId) {
    await executeQuery(
      'DELETE FROM google_drive_tokens WHERE account_id = ?',
      [accountId]
    );
  }

  /**
   * Check if account is connected
   */
  async isConnected(accountId) {
    const tokens = await this.getTokens(accountId);
    return tokens !== null;
  }
}

// Create singleton instance
const driveService = new GoogleDriveService();

module.exports = driveService;
