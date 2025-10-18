const { google } = require('googleapis');
const fs = require('fs-extra');
const path = require('path');

/**
 * Cloud Storage Service for Google Drive
 * Handles upload and download from Google Drive
 */

let driveClient = null;
let isConfigured = false;

/**
 * Initialize Google Drive client
 */
function initializeDriveClient() {
  if (!process.env.GOOGLE_DRIVE_ENABLED || process.env.GOOGLE_DRIVE_ENABLED === 'false') {
    console.log('⊗ Google Drive integration disabled');
    return false;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    isConfigured = true;
    console.log('✓ Google Drive client initialized');
    return true;
  } catch (error) {
    console.error('✗ Failed to initialize Google Drive:', error.message);
    return false;
  }
}

/**
 * Upload file to Google Drive
 */
async function uploadToDrive(filePath, fileName, mimeType) {
  if (!isConfigured) {
    throw new Error('Google Drive is not configured');
  }

  try {
    const fileMetadata = {
      name: fileName,
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await driveClient.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    console.log(`✓ File uploaded to Google Drive: ${fileName}`);
    return response.data;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error.message);
    throw error;
  }
}

/**
 * Download file from Google Drive
 */
async function downloadFromDrive(fileId, destinationPath) {
  if (!isConfigured) {
    throw new Error('Google Drive is not configured');
  }

  try {
    await fs.ensureDir(path.dirname(destinationPath));

    const dest = fs.createWriteStream(destinationPath);
    
    const response = await driveClient.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          console.log(`✓ File downloaded from Google Drive to: ${destinationPath}`);
          resolve(destinationPath);
        })
        .on('error', (err) => {
          console.error('Error downloading from Google Drive:', err.message);
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error) {
    console.error('Error downloading from Google Drive:', error.message);
    throw error;
  }
}

/**
 * Delete file from Google Drive
 */
async function removeFromDrive(fileId) {
  if (!isConfigured) {
    throw new Error('Google Drive is not configured');
  }

  try {
    await driveClient.files.delete({ fileId: fileId });
    console.log(`✓ File deleted from Google Drive: ${fileId}`);
    return true;
  } catch (error) {
    console.error('Error deleting from Google Drive:', error.message);
    throw error;
  }
}

/**
 * List files in Google Drive
 */
async function listDriveFiles(pageSize = 10) {
  if (!isConfigured) {
    throw new Error('Google Drive is not configured');
  }

  try {
    const response = await driveClient.files.list({
      pageSize: pageSize,
      fields: 'files(id, name, mimeType, size, createdTime)',
    });

    return response.data.files;
  } catch (error) {
    console.error('Error listing Google Drive files:', error.message);
    throw error;
  }
}

/**
 * Get file metadata from Google Drive
 */
async function getDriveFileInfo(fileId) {
  if (!isConfigured) {
    throw new Error('Google Drive is not configured');
  }

  try {
    const response = await driveClient.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, webViewLink',
    });

    return response.data;
  } catch (error) {
    console.error('Error getting file info from Google Drive:', error.message);
    throw error;
  }
}

module.exports = {
  initializeDriveClient,
  uploadToDrive,
  downloadFromDrive,
  removeFromDrive,
  listDriveFiles,
  getDriveFileInfo,
  isConfigured: () => isConfigured
};
