const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

/**
 * File Upload Middleware
 * Handles file uploads using multer
 */

// Configure storage
const fileStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
    // ensureDir returns a promise; call the callback when done or on error
    fs.ensureDir(uploadDir)
      .then(() => callback(null, uploadDir))
      .catch(err => callback(err));
  },
  filename: (req, file, callback) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    callback(null, filename);
  }
});

// File filter for video files
const videoFileFilter = (req, file, callback) => {
  const allowedFormats = (process.env.ALLOWED_FORMATS || 'mp4,avi,mov,mkv,flv,wmv,webm').split(',');
  const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
  
  if (allowedFormats.includes(extension)) {
    callback(null, true);
  } else {
    callback(new Error(`Invalid file format. Allowed formats: ${allowedFormats.join(', ')}`), false);
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
    fs.ensureDir(uploadDir)
      .then(() => callback(null, uploadDir))
      .catch(err => callback(err));
  },
  filename: (req, file, callback) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `profile_${uniqueId}${extension}`;
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
