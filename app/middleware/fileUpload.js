const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

/**
 * File Upload Middleware
 * Handles file uploads using multer
 */

const { getUniqueFilename } = require('../utilities/fileManager');

// Configure storage (sync, folder sudah dibuat saat server start)
const fileStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const filename = getUniqueFilename(file.originalname);
    callback(null, filename);
  }
});

// File filter for video files (cek mimetype dan ekstensi)
const videoFileFilter = (req, file, callback) => {
  const allowedMimes = [
    'video/mp4', 'video/avi', 'video/quicktime', 'video/mkv', 'video/flv', 'video/wmv', 'video/webm'
  ];
  const allowedExts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    callback(null, true);
  } else {
    callback(new Error('Invalid file format. Allowed formats: MP4, AVI, MOV, MKV, FLV, WMV, WEBM'), false);
  }
};

// Create multer upload instance
const videoUploader = multer({
  storage: fileStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5368709120') // Default 5GB
  }
});

/**
 * Profile picture upload configuration
 */
const profilePictureStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './storage/uploads', 'profiles');
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const filename = 'profile_' + getUniqueFilename(file.originalname);
    callback(null, filename);
  }
});

const imageFileFilter = (req, file, callback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
  
  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Invalid image format. Allowed: JPEG, PNG, GIF'), false);
  }
};

const profilePictureUploader = multer({
  storage: profilePictureStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * Error handler for multer errors
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: 'File size exceeds the maximum limit' 
      });
    }
    return res.status(400).json({ 
      success: false, 
      message: `Upload error: ${err.message}` 
    });
  } else if (err) {
    return res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
  next();
}

module.exports = {
  videoUploader: videoUploader.single('videoFile'),
  profilePictureUploader: profilePictureUploader.single('profilePicture'),
  handleUploadError
};
