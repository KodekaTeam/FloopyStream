const ffmpeg = require('fluent-ffmpeg');
const { getVideoDurationInSeconds } = require('get-video-duration');
const path = require('path');
const fs = require('fs-extra');
const ffmpegErrorHandler = require('../services/ffmpegErrorHandler');

// CRITICAL FIX: Use system FFmpeg instead of @ffmpeg-installer
// @ffmpeg-installer binaries cause SIGSEGV in Docker due to ABI incompatibility
// Use system binaries installed via apt in Dockerfile instead
if (process.env.NODE_ENV === 'production' || process.platform === 'linux') {
  // Docker/Linux: Use system FFmpeg
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
  ffmpeg.setFfprobePath('/usr/bin/ffprobe');
  console.log('✓ MediaProcessor using system FFmpeg: /usr/bin/ffmpeg');
} else {
  // Windows/Mac: Use npm package FFmpeg
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
  console.log('✓ MediaProcessor using npm FFmpeg:', ffmpegInstaller.path);
}

/**
 * Media Processing Utility
 * Handles video processing, thumbnail generation, etc.
 */

/**
 * Extract video metadata
 */
async function extractMediaInfo(filePath) {
  try {
    const duration = await getVideoDurationInSeconds(filePath);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Media info extraction timed out after 60 seconds'));
      }, 60000); // 60 seconds timeout

      ffmpeg.ffprobe(filePath, (err, metadata) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        
        resolve({
          durationSeconds: duration,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          codec: videoStream?.codec_name || 'unknown',
          bitrate: metadata.format?.bit_rate || 0,
          format: metadata.format?.format_name || 'unknown'
        });
      });
    });
  } catch (error) {
    console.error('Error extracting media info:', error.message);
    throw error;
  }
}

/**
 * Generate thumbnail from video
 */
async function createThumbnail(videoPath, outputPath, timeInSeconds = 1) {
  try {
    await fs.ensureDir(path.dirname(outputPath));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Thumbnail generation timed out after 120 seconds'));
      }, 120000); // 120 seconds timeout

      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '1280x720'
        })
        .on('end', () => {
          clearTimeout(timeout);
          console.log(`✓ Thumbnail generated: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          console.error('Error generating thumbnail:', err.message);
          reject(err);
        });
    });
  } catch (error) {
    console.error('Error creating thumbnail:', error.message);
    throw error;
  }
}

/**
 * Convert video to streaming-friendly format
 */
async function convertToStreamingFormat(inputPath, outputPath) {
  try {
    await fs.ensureDir(path.dirname(outputPath));

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log(`✓ Video converted: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error converting video:', err.message);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error('Error in video conversion:', error.message);
    throw error;
  }
}

/**
 * Extract audio from video
 */
async function extractAudioTrack(videoPath, outputPath) {
  try {
    await fs.ensureDir(path.dirname(outputPath));

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', () => {
          console.log(`✓ Audio extracted: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error extracting audio:', err.message);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error('Error extracting audio:', error.message);
    throw error;
  }
}

/**
 * Validate video file
 */
async function validateMediaFile(filePath) {
  try {
    const info = await extractMediaInfo(filePath);
    
    // Check if video has valid duration
    if (!info.durationSeconds || info.durationSeconds <= 0) {
      return { valid: false, reason: 'Invalid or corrupted video file' };
    }

    // Check if video has video stream
    if (info.width === 0 || info.height === 0) {
      return { valid: false, reason: 'No video stream found' };
    }

    return { valid: true, info };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

/**
 * Format duration to readable string
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  extractMediaInfo,
  createThumbnail,
  convertToStreamingFormat,
  extractAudioTrack,
  validateMediaFile,
  formatDuration
};
