const fs = require('fs-extra');
const path = require('path');

/**
 * File Management Utility
 * Handles directory creation and file operations
 */

/**
 * Ensure all required directories exist
 */
function createRequiredDirectories() {
  const directories = [
    process.env.UPLOAD_DIR || './storage/uploads',
    process.env.MEDIA_DIR || './storage/media',
    process.env.THUMBNAIL_DIR || './storage/thumbnails',
    process.env.TEMP_DIR || './storage/temp',
    process.env.LOG_DIR || './storage/logs',
    path.dirname(process.env.DB_PATH || './storage/database/floopystream.db')
  ];

  directories.forEach(dir => {
    try {
      fs.ensureDirSync(dir);
      console.log(`✓ Directory ready: ${dir}`);
    } catch (error) {
      console.error(`✗ Failed to create directory ${dir}:`, error.message);
    }
  });
}

/**
 * Get file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Clean temporary files older than specified time
 */
async function cleanTemporaryFiles(olderThanHours = 24) {
  const tempDir = process.env.TEMP_DIR || './storage/temp';
  const now = Date.now();
  const maxAge = olderThanHours * 60 * 60 * 1000;

  try {
    const files = await fs.readdir(tempDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.remove(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`✓ Cleaned ${deletedCount} temporary file(s)`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning temporary files:', error.message);
    return 0;
  }
}

/**
 * Delete file safely
 */
async function removeFile(filePath) {
  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error removing file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Move file to new location
 */
async function relocateFile(sourcePath, destinationPath) {
  try {
    await fs.ensureDir(path.dirname(destinationPath));
    await fs.move(sourcePath, destinationPath, { overwrite: true });
    return true;
  } catch (error) {
    console.error(`Error relocating file:`, error.message);
    return false;
  }
}

/**
 * Copy file to new location
 */
async function duplicateFile(sourcePath, destinationPath) {
  try {
    await fs.ensureDir(path.dirname(destinationPath));
    await fs.copy(sourcePath, destinationPath);
    return true;
  } catch (error) {
    console.error(`Error duplicating file:`, error.message);
    return false;
  }
}

/**
 * Get disk usage for a directory
 */
async function calculateDirectorySize(directoryPath) {
  let totalSize = 0;

  async function scanDirectory(dirPath) {
    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await scanDirectory(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error.message);
    }
  }

  await scanDirectory(directoryPath);
  return totalSize;
}

module.exports = {
  createRequiredDirectories,
  formatFileSize,
  cleanTemporaryFiles,
  removeFile,
  relocateFile,
  duplicateFile,
  calculateDirectorySize
};
