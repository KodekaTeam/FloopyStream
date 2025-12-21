const ffmpeg = require('fluent-ffmpeg');
const { logInfo, logError } = require('./activityLogger');
const Broadcast = require('../models/Broadcast');
const ffmpegErrorHandler = require('./ffmpegErrorHandler');
const {
  ConnectionHealthMonitor,
  RetryStrategy,
  StreamErrorDetector,
  NetworkQualityMonitor
} = require('./connectionRecovery');
const { v4: uuidv4 } = require('uuid');

// CRITICAL FIX: Use system FFmpeg instead of @ffmpeg-installer
// @ffmpeg-installer binaries cause SIGSEGV in Docker due to ABI incompatibility
// Use system binaries installed via apt in Dockerfile instead
if (process.env.NODE_ENV === 'production' || process.platform === 'linux') {
  // Docker/Linux: Use system FFmpeg
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
  ffmpeg.setFfprobePath('/usr/bin/ffprobe');
  console.log('✓ Using system FFmpeg: /usr/bin/ffmpeg');
} else {
  // Windows/Mac: Use npm package FFmpeg
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
  console.log('✓ Using npm FFmpeg:', ffmpegInstaller.path);
}

/**
 * Check if video has audio stream
 * @param {string} videoPath - Path to video file
 * @returns {Promise<boolean>} - True if video has audio, false otherwise
 */
function hasAudioStream(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve(!!audioStream);
    });
  });
}

/**
 * Get video resolution
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{width: number, height: number}>} - Video dimensions
 */
function getVideoResolution(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (videoStream && videoStream.width && videoStream.height) {
        resolve({ width: videoStream.width, height: videoStream.height });
      } else {
        reject(new Error('Could not determine video resolution'));
      }
    });
  });
}

/**
 * Live Broadcasting Service
 * Manages live streams to various platforms
 */

// Active broadcast processes
const activeBroadcastProcesses = new Map();

/**
 * Start a live broadcast
 * @param {number} broadcastId - Broadcast ID
 * @param {string} videoFilePath - Path to video file
 * @param {string} destinationUrl - RTMP destination URL
 * @param {string} streamKey - Stream key
 * @param {number} maxDurationSeconds - Maximum duration in seconds (optional, default: no limit)
 */
/**
 * Wait for connection to be fully released
 * @param {number} ms - Milliseconds to wait
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if destination is Facebook (requires special handling)
 * @param {string} url - Destination URL
 */
function isFacebookStream(url) {
  const fbPatterns = [
    'facebook.com',
    'live-api-s.facebook.com',
    'live-api.facebook.com',
    'rtmps://live-api'
  ];
  return fbPatterns.some(pattern => url.includes(pattern));
}

/**
 * Check if destination is YouTube
 * @param {string} url - Destination URL
 */
function isYouTubeStream(url) {
  const ytPatterns = [
    'youtube.com',
    'youtu.be',
    'rtmp.youtube.com',
    'rtsps://a.rtmp.youtube.com'
  ];
  return ytPatterns.some(pattern => url.includes(pattern));
}

/**
 * Add connection timeout options for FFmpeg output
 * Prevents infinite hangs on network issues
 */
function getConnectionTimeoutOptions() {
  return [
    // Socket options
    '-socket_timeout', '10000000',  // 10 second socket timeout (microseconds)
    '-tcp_nodelay', '1',             // Disable Nagle's algorithm for low latency
    '-fflags', 'nobuffer',           // Minimize buffering
    // Connection handling
    '-rtmp_pageurl', 'http://127.0.0.1',  // Add referer to avoid blocking
    '-rtmp_swfverify', 'no'          // Skip SWF verification
  ];
}

/**
 * Wrap broadcast function with auto-reconnect logic
 */
async function broadcastWithAutoReconnect(
  broadcastId, 
  videoFilePath, 
  destinationUrl, 
  streamKey, 
  maxDurationSeconds,
  advancedSettings,
  isPlaylist = false,
  playlistData = null,
  userUuid = null
) {
  const retryStrategy = new RetryStrategy(4); // Max 4 retries for YouTube
  const healthMonitor = new ConnectionHealthMonitor(broadcastId);
  const networkMonitor = new NetworkQualityMonitor(broadcastId);

  let lastError = null;
  let isUserInitiatedStop = false;

  // Mark broadcast as recovering to prevent duplicate restarts
  let isRecovering = false;

  while (retryStrategy.canRetry() && !isUserInitiatedStop) {
    try {
      console.log(`\n🎬 [Broadcast ${broadcastId}] Starting stream (Attempt ${retryStrategy.attempts + 1})`);

      if (isPlaylist) {
        // Start playlist broadcast
        await startPlaylistBroadcast(
          broadcastId,
          playlistData.videos,
          destinationUrl,
          streamKey,
          playlistData.shuffle || false,
          playlistData.loop || true,
          advancedSettings,
          userUuid
        );
      } else {
        // Start single video broadcast
        await startLiveBroadcast(
          broadcastId,
          videoFilePath,
          destinationUrl,
          streamKey,
          maxDurationSeconds,
          advancedSettings,
          { 
            healthMonitor, 
            networkMonitor,
            isYouTube: isYouTubeStream(destinationUrl)
          },
          userUuid
        );
      }

      // If we reach here, stream ended successfully
      console.log(`✅ [Broadcast ${broadcastId}] Stream ended successfully`);
      await logInfo('Stream completed successfully', { broadcastId });
      break;

    } catch (error) {
      lastError = error;
      const errorMsg = error.message || error.toString();
      
      console.error(`❌ [Broadcast ${broadcastId}] Stream error: ${errorMsg}`);

      // Check if this is a user-initiated stop
      if (errorMsg.includes('killed with signal SIGKILL') || errorMsg.includes('killed with signal SIGTERM')) {
        console.log('User initiated stream stop');
        isUserInitiatedStop = true;
        break;
      }

      // Check if it's a fatal error (don't retry)
      if (StreamErrorDetector.isFatalError(error)) {
        console.error('❌ Fatal error detected - not retrying:', errorMsg);
        await logError('Fatal broadcast error - no retry', { broadcastId, error: errorMsg });
        break;
      }

      // Check if it's a memory error
      if (StreamErrorDetector.isMemoryError(error)) {
        console.error('⚠️  Memory error detected:', errorMsg);
        await logError('Memory error in broadcast', { broadcastId, error: errorMsg });
        await Broadcast.updateStatus(broadcastId, 'failed', 'Memory error - try reducing bitrate/resolution or restarting');
        break;
      }

      // Log connection error
      if (StreamErrorDetector.isConnectionError(error)) {
        console.warn(`⚠️  Connection error detected on attempt ${retryStrategy.attempts + 1}:`, errorMsg);
        networkMonitor.recordReconnectAttempt();
        
        // If too many reconnect attempts, suggest network issue
        if (retryStrategy.attempts >= 2) {
          await logError('Multiple connection failures - possible network issue', {
            broadcastId,
            attempts: retryStrategy.attempts + 1,
            lastError: errorMsg,
            networkStatus: networkMonitor.getStatus()
          });
        }
      }

      // If we can retry, wait before attempting again
      if (retryStrategy.canRetry()) {
        await retryStrategy.waitBeforeRetry();
        
        // Update broadcast status to show reconnecting
        await Broadcast.updateStatus(
          broadcastId, 
          'reconnecting', 
          `Attempting to reconnect (${retryStrategy.attempts}/${retryStrategy.maxRetries})...`
        );
      } else {
        // Max retries reached
        console.error(`❌ Max reconnection attempts (${retryStrategy.maxRetries}) reached`);
        await logError('Broadcast failed - max retries reached', {
          broadcastId,
          attempts: retryStrategy.attempts,
          retryLog: retryStrategy.getLog(),
          lastError: errorMsg,
          networkStatus: networkMonitor.getStatus()
        });
        
        // Final error message
        let finalErrorMsg = `Stream disconnected after ${retryStrategy.attempts} reconnection attempts.`;
        if (isYouTubeStream(destinationUrl)) {
          finalErrorMsg += ' Check: (1) YouTube stream key is valid, (2) Network connection is stable, (3) YouTube account has streaming enabled';
        }
        await Broadcast.updateStatus(broadcastId, 'failed', finalErrorMsg);
        break;
      }
    }
  }

  // Cleanup health monitor
  healthMonitor.stopMonitoring();

  if (isUserInitiatedStop) {
    console.log(`✓ Broadcast ${broadcastId} stopped by user`);
  }
}

/**
 * Start live broadcast with playlist (multiple videos)
 * @param {number} broadcastId - Broadcast ID
 * @param {Array} videos - Array of video objects with filepath
 * @param {string} destinationUrl - RTMP destination URL
 * @param {string} streamKey - Stream key
 * @param {boolean} shuffle - Whether to shuffle videos
 * @param {boolean} loop - Whether to loop playlist
 * @param {object} advancedSettings - Advanced Settings (bitrate, frame_rate, resolution, orientation)
 * @param {string} userUuid - User UUID for notifications
 */
async function startPlaylistBroadcast(broadcastId, videos, destinationUrl, streamKey, shuffle = false, loop = true, advancedSettings = {}, userUuid = null) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Parse Advanced Settings
    const bitrate = advancedSettings.bitrate || '2500k';
    const frameRate = advancedSettings.framerate || advancedSettings.frame_rate || 30;
    const resolution = advancedSettings.resolution || 'auto-detect';
    const orientation = advancedSettings.orientation || 'landscape';
    
    console.log(`📊 Advanced Settings (Playlist): Bitrate=${bitrate}, FPS=${frameRate}, Resolution=${resolution}, Orientation=${orientation}`);
    
    // Check if broadcast is already running - if so, kill the old process first
    if (activeBroadcastProcesses.has(broadcastId)) {
      console.log(`⚠️  Broadcast ${broadcastId} already has an active process, killing old process first`);
      try {
        const oldProcess = activeBroadcastProcesses.get(broadcastId);
        oldProcess.kill('SIGKILL'); // Force kill old process
        activeBroadcastProcesses.delete(broadcastId);
        console.log(`✅ Killed old process for broadcast ${broadcastId}`);
      } catch (killError) {
        console.warn(`Failed to kill old process for broadcast ${broadcastId}:`, killError.message);
        // Continue anyway
      }
    }

    if (!videos || videos.length === 0) {
      throw new Error('Playlist is empty');
    }

    // Construct full destination URL
    const baseUrl = destinationUrl.endsWith('/') 
      ? destinationUrl.slice(0, -1) 
      : destinationUrl;
    const fullDestinationUrl = streamKey 
      ? `${baseUrl}/${streamKey}`
      : baseUrl;

    // Special handling for Facebook
    if (isFacebookStream(destinationUrl)) {
      console.log('⏳ Facebook stream detected. Waiting for connection cleanup...');
      await delay(3000);
      await logInfo('Waiting for Facebook connection cleanup', { broadcastId, delay: '3s' });
    }

    // Get video paths
    let videoPaths = videos.map(video => {
      const videoPath = video.filepath;
      
      // Already absolute path
      if (path.isAbsolute(videoPath)) {
        return videoPath;
      }
      
      // Relative path - resolve it
      // First check if path is already resolved from __dirname
      const directPath = path.join(__dirname, '..', videoPath);
      if (fs.existsSync(directPath)) {
        return directPath;
      }
      
      // If not found in any location, return resolved path (will fail validation later)
      return path.resolve(videoPath);
    });

    // Validate video files exist BEFORE shuffling
    console.log('Validating video files...');
    for (let i = 0; i < videoPaths.length; i++) {
      const videoPath = videoPaths[i];
      console.log(`  [${i + 1}/${videoPaths.length}] Checking: ${videoPath}`);
      
      if (!fs.existsSync(videoPath)) {
        // Try to find file in common locations
        const basename = path.basename(videoPath);
        const possiblePaths = [
          videoPath,
          // Check storage/uploads first (current location)
          path.join(__dirname, '..', 'storage', 'uploads', basename),
          path.join(process.cwd(), 'storage', 'uploads', basename),
          // Check storage/media as fallback (old location)
          path.join(__dirname, '..', 'storage', 'media', basename),
          path.join(process.cwd(), 'storage', 'media', basename)
        ];
        
        let foundPath = null;
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            foundPath = testPath;
            console.log(`  ✓ Found at: ${testPath}`);
            break;
          }
        }
        
        if (!foundPath) {
          throw new Error(`Video file not found: ${videoPath}\nAlso checked:\n${possiblePaths.join('\n')}`);
        }
        
        videoPaths[i] = foundPath;
      } else {
        console.log(`  ✓ Found`);
      }
    }

    // Shuffle if requested
    if (shuffle) {
      videoPaths = videoPaths.sort(() => Math.random() - 0.5);
      await logInfo('Playlist shuffled', { broadcastId, count: videoPaths.length });
    }

    // Shuffle videos if needed
    if (shuffle) {
      // Fisher-Yates shuffle algorithm
      for (let i = videoPaths.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videoPaths[i], videoPaths[j]] = [videoPaths[j], videoPaths[i]];
      }
    }

    // Create concat file for FFmpeg
    const concatFilePath = path.join(__dirname, '..', 'storage', 'temp', `playlist_${broadcastId}.txt`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(concatFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate concat file content
    let concatContent = '';
    if (loop) {
      // Repeat playlist 1000 times for continuous loop
      for (let i = 0; i < 1000; i++) {
        videoPaths.forEach(videoPath => {
          concatContent += `file '${videoPath.replace(/\\/g, '/')}'\n`;
        });
      }
    } else {
      videoPaths.forEach(videoPath => {
        concatContent += `file '${videoPath.replace(/\\/g, '/')}'\n`;
      });
    }

    fs.writeFileSync(concatFilePath, concatContent);

    // Detect resolution from first video (or use Advanced Settings)
    let outputWidth = 1280, outputHeight = 720; // Default
    
    if (resolution && resolution !== 'auto' && resolution !== 'auto-detect') {
      // Use Advanced Settings resolution
      const resolutionMap = {
        '720p': { w: 1280, h: 720 },
        '1080p': { w: 1920, h: 1080 },
        '1440p': { w: 2560, h: 1440 },
        '2160p': { w: 3840, h: 2160 }
      };
      
      if (resolutionMap[resolution]) {
        outputWidth = resolutionMap[resolution].w;
        outputHeight = resolutionMap[resolution].h;
        console.log(`📐 Playlist using Advanced Settings resolution: ${outputWidth}x${outputHeight} (${resolution})`);
      } else {
        // Fall back to detecting from video
        try {
          const firstVideoResolution = await getVideoResolution(videoPaths[0]);
          outputWidth = firstVideoResolution.width;
          outputHeight = firstVideoResolution.height;
          
          // Ensure minimum 480p
          if (outputHeight < 480) {
            const scale = 480 / outputHeight;
            outputHeight = 480;
            outputWidth = Math.round(outputWidth * scale);
            if (outputWidth % 2 !== 0) outputWidth++;
          }
          
          console.log(`Playlist output resolution: ${outputWidth}x${outputHeight}`);
        } catch (err) {
          console.warn('Could not detect playlist video resolution, using default 1280x720');
        }
      }
    } else {
      // Detect resolution from first video
      try {
        const firstVideoResolution = await getVideoResolution(videoPaths[0]);
        outputWidth = firstVideoResolution.width;
        outputHeight = firstVideoResolution.height;
        
        // Ensure minimum 480p
        if (outputHeight < 480) {
          const scale = 480 / outputHeight;
          outputHeight = 480;
          outputWidth = Math.round(outputWidth * scale);
          if (outputWidth % 2 !== 0) outputWidth++;
        }
        
        console.log(`Playlist output resolution: ${outputWidth}x${outputHeight}`);
      } catch (err) {
        console.warn('Could not detect playlist video resolution, using default 1280x720');
      }
    }

    // Check if first video has audio (assume all videos have same audio config)
    let playlistHasAudio = true;
    try {
      playlistHasAudio = await hasAudioStream(videoPaths[0]);
      console.log(`Playlist audio detected: ${playlistHasAudio ? 'Yes' : 'No (will add silent audio)'}`);
    } catch (err) {
      console.warn('Could not detect audio, assuming videos have audio');
    }

    await logInfo('Starting playlist broadcast', { 
      broadcastId, 
      destination: destinationUrl,
      videoCount: videos.length,
      shuffle,
      loop,
      resolution: `${outputWidth}x${outputHeight}`,
      hasAudio: playlistHasAudio
    });

    // Input options for concat - SAFER settings with verbose logging
    const inputOptions = [
      '-re',                               // Read input at native frame rate
      '-loglevel', 'verbose',              // VERBOSE logging to debug SIGSEGV
      '-fflags', '+genpts+igndts',         // Generate PTS + ignore DTS
      '-avoid_negative_ts', 'make_zero',   // Fix timestamp issues
      '-analyzeduration', '2147483647',    // Max analyze duration
      '-probesize', '2147483647',          // Max probe size
      '-f', 'concat',                      // Concat demuxer
      '-safe', '0'                         // Allow absolute paths
    ];

    // Calculate bitrate values from Advanced Settings
    const baseVideoBitrate = bitrate;
    const maxBitrate = bitrate.replace('k', '') * 1.5 + 'k';
    const bufferSize = bitrate.replace('k', '') * 2 + 'k';

    // Output options
    let outputOptions;
    if (Object.keys(advancedSettings).length === 0) {
      // No advanced settings: copy codec (no re-encode)
      outputOptions = [
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'flv'
      ];
    } else {
      // With advanced settings: re-encode
      // Output options - FORCE RE-ENCODE for now (safer than copy codec)
      outputOptions = [
        // ALWAYS re-encode with SAFE settings
        '-c:v', 'libx264',                   // H.264 video codec
        '-preset', 'ultrafast',              // Fastest encoding (less CPU)
        '-tune', 'zerolatency',              // Low latency
        '-profile:v', 'baseline',            // BASELINE profile (most compatible)
        '-level', '3.0',                     // Level 3.0 (compatible)
        '-b:v', baseVideoBitrate,            // Video bitrate
        '-maxrate', maxBitrate,              // Max bitrate
        '-bufsize', bufferSize,              // Buffer size
        '-pix_fmt', 'yuv420p',               // Pixel format
        '-g', '60',                          // GOP size
        '-r', String(frameRate),             // Frame rate
        '-s', `${outputWidth}x${outputHeight}`, // Output size
        // Audio codec will be set based on whether playlist has audio or not
        '-max_muxing_queue_size', '1024',    // Large muxing queue
        '-f', 'flv'                          // FLV format
      ];
    }

    // Create FFmpeg process for playlist
    let ffmpegProcess;
    
    if (!playlistHasAudio) {
      // For videos without audio, add silent audio as second input
      ffmpegProcess = ffmpeg(concatFilePath)
        .inputOptions(inputOptions)
        .input('anullsrc=channel_layout=stereo:sample_rate=44100')
        .inputFormat('lavfi')
        .outputOptions(outputOptions)
        .outputOptions([
          '-map', '0:v',  // Map video from first input (concat)
          '-map', '1:a',  // Map audio from second input (anullsrc)
          '-c:a', 'aac',  // Ensure AAC codec is applied to the mapped audio
          '-b:a', '128k', // Audio bitrate
          '-ar', '44100', // Audio sample rate
          '-ac', '2',     // Stereo audio
          '-shortest'     // Stop when shortest input ends
        ])
        .output(fullDestinationUrl);
    } else {
      // Normal flow for videos with audio
      ffmpegProcess = ffmpeg(concatFilePath)
        .inputOptions(inputOptions)
        .outputOptions(outputOptions)
        .output(fullDestinationUrl);
    }

    // Add audio codec settings for playlist with audio
    if (playlistHasAudio) {
      ffmpegProcess = ffmpegProcess.outputOptions([
        '-c:a', 'aac',  // AAC audio codec
        '-b:a', '128k', // Audio bitrate
        '-ar', '44100', // Audio sample rate
        '-ac', '2'      // Stereo audio
      ]);
    }
    
    // Add event handlers to ffmpegProcess
    ffmpegProcess
      .on('start', async (commandLine) => {
        console.log('FFmpeg playlist command:', commandLine);
        console.log('Streaming playlist to:', fullDestinationUrl);
        await Broadcast.updateStatus(broadcastId, 'active');
        await logInfo('Playlist broadcast started successfully', { broadcastId });
      })
      .on('progress', (progress) => {
        if (progress.timemark) {
          const seconds = Math.floor(progress.timemark.split(':').reduce((acc, time) => (60 * acc) + +time));
          if (seconds % 10 === 0) {
            console.log(`[Playlist ${broadcastId}] Progress: ${progress.timemark} | FPS: ${progress.currentFps || 'N/A'} | Bitrate: ${progress.currentKbps || 'N/A'}kbps`);
          }
        }
      })
      .on('error', async (err, stdout, stderr) => {
        const isUserStop = err.message.includes('killed with signal SIGKILL') || 
                          err.message.includes('killed with signal SIGTERM');
        
        // Check for SIGSEGV in playlist as well
        const isSIGSEGV = err.message.includes('killed with signal SIGSEGV');
        
        if (isUserStop) {
          console.log('Playlist broadcast stopped by user');
          await logInfo('Playlist broadcast stopped by user', { broadcastId });
        } else if (isSIGSEGV) {
          console.error('🔴 CRITICAL: ffmpeg crashed with SIGSEGV (segmentation fault) in playlist');
          console.error('   This usually indicates: insufficient memory, codec library issue, or corrupt video');
          await logError('Playlist broadcast SIGSEGV crash', { 
            broadcastId, 
            error: err.message,
            suggestion: 'Increase Docker memory or check video files'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', 
            'FFmpeg crashed (SIGSEGV). Try increasing Docker memory or checking video files.');
          
          // Send error notification
          if (userUuid) {
            try {
              const NotificationService = require('./notificationService');
              await NotificationService.sendToUserChannels(userUuid, 'error', {
                message: 'Playlist broadcast failed - FFmpeg crashed (SIGSEGV)',
                details: 'This usually indicates insufficient memory, codec library issue, or corrupt video files. Try increasing Docker memory or checking video files.'
              });
            } catch (notificationError) {
              console.error('Playlist error notification failed:', notificationError);
            }
          }
        } else {
          console.error('Playlist broadcast error:', err.message);
          await logError('Playlist broadcast failed', { 
            broadcastId, 
            error: err.message,
            stderr: stderr || 'N/A'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', err.message);
          
          // Send error notification
          if (userUuid) {
            try {
              const NotificationService = require('./notificationService');
              await NotificationService.sendToUserChannels(userUuid, 'error', {
                message: 'Playlist broadcast failed',
                details: err.message
              });
            } catch (notificationError) {
              console.error('Playlist error notification failed:', notificationError);
            }
          }
        }
        
        activeBroadcastProcesses.delete(broadcastId);
        
        // Cleanup concat file
        try {
          if (fs.existsSync(concatFilePath)) {
            fs.unlinkSync(concatFilePath);
          }
        } catch (cleanupErr) {
          console.error('Error cleaning up concat file:', cleanupErr.message);
        }
      })
      .on('end', async () => {
        console.log('Playlist broadcast ended normally');
        await logInfo('Playlist broadcast ended', { broadcastId });
        await Broadcast.updateStatus(broadcastId, 'completed');
        activeBroadcastProcesses.delete(broadcastId);
        
        // Cleanup concat file
        try {
          if (fs.existsSync(concatFilePath)) {
            fs.unlinkSync(concatFilePath);
          }
        } catch (cleanupErr) {
          console.error('Error cleaning up concat file:', cleanupErr.message);
        }
      });

    // Run the process
    ffmpegProcess.run();

    // Store the process
    activeBroadcastProcesses.set(broadcastId, ffmpegProcess);

    console.log(`✓ Playlist broadcast ${broadcastId} started with ${videos.length} videos`);
    return { success: true, broadcastId };

  } catch (error) {
    console.error('Error starting playlist broadcast:', error);
    await logError('Failed to start playlist broadcast', { 
      broadcastId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Start a live broadcast
 * @param {number} broadcastId - Broadcast ID
 * @param {string} videoFilePath - Path to video file
 * @param {string} destinationUrl - RTMP destination URL
 * @param {string} streamKey - Stream key
 * @param {number} maxDurationSeconds - Maximum duration in seconds (optional, default: no limit)
 * @param {object} advancedSettings - Advanced Settings (bitrate, frame_rate, resolution, orientation)
 * @param {object} options - Internal options (healthMonitor, networkMonitor, isYouTube, etc)
 * @param {string} userUuid - User UUID for notifications
 */
async function startLiveBroadcast(broadcastId, videoFilePath, destinationUrl, streamKey, maxDurationSeconds = null, advancedSettings = {}, options = {}, userUuid = null) {
  try {
    // Check if broadcast is already running - if so, kill the old process first
    if (activeBroadcastProcesses.has(broadcastId)) {
      console.log(`⚠️  Broadcast ${broadcastId} already has an active process, killing old process first`);
      try {
        const oldProcess = activeBroadcastProcesses.get(broadcastId);
        oldProcess.kill('SIGKILL'); // Force kill old process
        activeBroadcastProcesses.delete(broadcastId);
        console.log(`✅ Killed old process for broadcast ${broadcastId}`);
      } catch (killError) {
        console.warn(`Failed to kill old process for broadcast ${broadcastId}:`, killError.message);
        // Continue anyway
      }
    }

    // Parse Advanced Settings
    // bitrate format: "2500k", frame_rate: "30", resolution: "720p", orientation: "landscape"
    const bitrate = advancedSettings.bitrate || '2500k';
    const frameRate = advancedSettings.framerate || advancedSettings.frame_rate || 30;
    const resolution = advancedSettings.resolution || 'auto-detect';
    const orientation = advancedSettings.orientation || 'landscape';
    
    console.log(`📊 Advanced Settings: Bitrate=${bitrate}, FPS=${frameRate}, Resolution=${resolution}, Orientation=${orientation}`);

    // Special handling for YouTube: Re-bind stream if broadcast is already live
    if (options && options.isYouTube) {
      try {
        const broadcast = await Broadcast.findById(broadcastId);
        if (broadcast && broadcast.youtube_broadcast_id) {
          const youtubeService = require('./youtubeService');
          const { sanitizeYouTubeTitle } = require('../utils/youtubeMetadata');
          
          // Get OAuth for the broadcast's channel
          const { fetchOne, executeQuery } = require('../core/database');
          const oauthRecord = await fetchOne(
            'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
            [broadcast.channel_uuid, 'google']
          );
          
          if (oauthRecord) {
            await youtubeService.initializeWithOAuth(oauthRecord);
            const broadcastStatus = await youtubeService.getBroadcastStatus(broadcast.youtube_broadcast_id);
            
            if (broadcastStatus === 'live') {
              console.log(`📺 YouTube broadcast ${broadcast.youtube_broadcast_id} is already live, re-binding stream`);
              
              // Get stream key record to get YouTube stream ID
              const streamKeyRecord = await fetchOne(
                'SELECT * FROM streamkeys WHERE stream_key = ? AND channel_uuid = ?',
                [streamKey, broadcast.channel_uuid]
              );
              
              if (streamKeyRecord && streamKeyRecord.youtube_stream_id) {
                // Re-bind the stream to the live broadcast
                await youtubeService.youtube.liveBroadcasts.bind({
                  id: broadcast.youtube_broadcast_id,
                  part: 'id,snippet,status,contentDetails',
                  streamId: streamKeyRecord.youtube_stream_id
                });
                
                console.log('✅ Successfully re-bound stream to live YouTube broadcast');
                
                // Trigger metadata sync if template exists
                if (broadcast.template_uuid) {
                  const { addBroadcastForMetadataSync } = require('./metadataSyncService');
                  await addBroadcastForMetadataSync(broadcast.broadcast_uuid, broadcast.youtube_broadcast_id, broadcast.template_uuid, broadcast.channel_uuid);
                  console.log('📋 Queued metadata sync after re-bind');
                }
              } else {
                console.warn('⚠️ No YouTube stream ID found for re-bind');
              }
            } else if ((broadcastStatus === 'complete' || broadcastStatus === null)) {
              console.log(`🔄 YouTube broadcast status: ${broadcastStatus}. Creating new broadcast...`);
              
              // Get template data if available
              let templateSettings = null;
              if (broadcast.template_uuid) {
                try {
                  const UploadTemplate = require('./../models/UploadTemplate');
                  const template = await UploadTemplate.findByUuid(broadcast.template_uuid);
                  
                  if (template) {
                    console.log('✅ Found template for reconnection:', template.template_name);
                    
                    // Process template data similar to broadcastController
                    const tags = (() => {
                      if (Array.isArray(template.template_tags)) {
                        return template.template_tags;
                      } else if (typeof template.template_tags === 'string') {
                        try {
                          const parsed = JSON.parse(template.template_tags);
                          return Array.isArray(parsed) ? parsed : [template.template_tags];
                        } catch (e) {
                          return template.template_tags.includes(',') ?
                            template.template_tags.split(',').map(tag => tag.trim()) :
                            [template.template_tags.trim()];
                        }
                      }
                      return [];
                    })();
                    
                    templateSettings = {
                      title: broadcast.broadcast_name || 'FloopyStream Broadcast',
                      description: template.template_description || `Broadcast created from FloopyStream on ${new Date().toISOString()}`,
                      tags: tags,
                      category: template.template_category,
                      visibility: template.template_visibility || 'private',
                      audience: template.template_audience || 'no',
                      language: template.template_language_video || 'en'
                    };
                    
                    console.log('📋 Using template metadata for new broadcast:', {
                      title: templateSettings.title,
                      description: templateSettings.description.substring(0, 100) + '...',
                      tags: templateSettings.tags,
                      category: templateSettings.category,
                      visibility: templateSettings.visibility,
                      audience: templateSettings.audience,
                      language: templateSettings.language
                    });
                  } else {
                    console.warn('⚠️ Template not found for reconnection:', broadcast.template_uuid);
                  }
                } catch (templateError) {
                  console.warn('⚠️ Error loading template for reconnection:', templateError.message);
                }
              }
              
              // Use template settings or fallback to broadcast data
              const rawBroadcastTitle = templateSettings?.title || broadcast.broadcast_name || 'FloopyStream Broadcast';
              const broadcastTitle = sanitizeYouTubeTitle(rawBroadcastTitle, {
                fallback: 'FloopyStream Broadcast',
                maxLength: 100
              });
              const broadcastDescription = templateSettings?.description || `Broadcast created from FloopyStream on ${new Date().toISOString()}`;
              
              // Create new broadcast configuration
              const broadcastConfig = {
                part: 'id,snippet,status,contentDetails',
                resource: {
                  snippet: {
                    title: broadcastTitle,
                    description: broadcastDescription,
                    scheduledStartTime: new Date().toISOString(), // Start now instead of future
                    ...(templateSettings?.language && {
                      defaultLanguage: templateSettings.language
                    })
                  },
                  status: {
                    privacyStatus: templateSettings?.visibility || 'private',
                    selfDeclaredMadeForKids: templateSettings?.audience === 'yes' || templateSettings?.audience === 'made_for_kids'
                  },
                  contentDetails: {
                    enableAutoStart: broadcast.enable_autostart === 'true',
                    enableAutoStop: broadcast.enable_autoend === 'true',
                    enableClosedCaptions: false,
                    enableDvr: broadcast.enable_dvr === 'true',
                    enableEmbed: false,
                    recordFromStart: true,
                    startWithSlate: false,
                    enableContentEncryption: false,
                    enableMonitoring: false,
                    enableLowLatency: broadcast.enable_360 === 'true'
                  }
                }
              };

              // IMPORTANT: Reuse the existing stream key & YouTube stream.
              // Do NOT create a new stream (which would generate a new stream key).
              console.log('♻️ Reusing existing YouTube stream for re-stream...');

              const streamKeyRecordForRestream = await fetchOne(
                'SELECT * FROM streamkeys WHERE stream_key = ? AND channel_uuid = ? LIMIT 1',
                [streamKey, broadcast.channel_uuid]
              );

              const existingYouTubeStreamId = streamKeyRecordForRestream?.youtube_stream_id;
              if (!existingYouTubeStreamId) {
                throw new Error('No YouTube stream ID found for this stream key. Cannot re-stream without creating a new stream.');
              }

              console.log('✅ Using existing YouTube stream ID:', existingYouTubeStreamId);

              // Create broadcast bound to the existing stream to ensure YouTube Studio shows the right stream key immediately
              console.log('📺 Creating new YouTube broadcast with bound (existing) stream...');

              // Add boundStreamId to broadcast config
              broadcastConfig.resource.contentDetails.boundStreamId = existingYouTubeStreamId;
              
              console.log('📝 Updated broadcast creation config with boundStreamId:', JSON.stringify(broadcastConfig, null, 2));
              
              // Create new broadcast with bound stream
              const newBroadcastResponse = await youtubeService.youtube.liveBroadcasts.insert(broadcastConfig);
              const newBroadcastId = newBroadcastResponse.data.id;
              
              console.log('✅ Created new YouTube broadcast with bound stream:', newBroadcastId);
              console.log('📄 Full response:', JSON.stringify(newBroadcastResponse.data, null, 2));

              // IMPORTANT: Explicitly bind the stream as well.
              // In practice this helps YouTube Studio reflect the correct stream key immediately,
              // rather than showing the channel's default stream until a later reconnect.
              console.log('🔗 Explicitly binding new YouTube stream to new broadcast...');
              await youtubeService.youtube.liveBroadcasts.bind({
                id: newBroadcastId,
                part: 'id,snippet,status,contentDetails',
                streamId: existingYouTubeStreamId
              });
              console.log('✅ Explicit stream bind completed');
              
              // Verify the stream is properly bound by checking broadcast details
              console.log('🔍 Verifying stream binding...');
              let verifiedBoundStreamId;
              for (let attempt = 1; attempt <= 6; attempt++) {
                const verifyResponse = await youtubeService.youtube.liveBroadcasts.list({
                  part: 'contentDetails',
                  id: newBroadcastId
                });

                verifiedBoundStreamId = verifyResponse.data.items?.[0]?.contentDetails?.boundStreamId;
                console.log(`🔍 Binding check attempt ${attempt}:`, {
                  broadcastId: newBroadcastId,
                  expectedStreamId: existingYouTubeStreamId,
                  boundStreamId: verifiedBoundStreamId
                });

                if (verifiedBoundStreamId === existingYouTubeStreamId) {
                  console.log('✅ Stream binding verified successfully');
                  break;
                }

                // Sometimes YouTube Studio lags; retry bind once mid-way.
                if (attempt === 3) {
                  console.log('🔁 Retrying explicit bind to help propagation...');
                  await youtubeService.youtube.liveBroadcasts.bind({
                    id: newBroadcastId,
                    part: 'id,snippet,status,contentDetails',
                    streamId: existingYouTubeStreamId
                  });
                }

                await delay(1000);
              }

              if (verifiedBoundStreamId !== existingYouTubeStreamId) {
                console.warn('⚠️ Stream binding verification failed - boundStreamId mismatch');
              }
              
              // Update database with new broadcast and stream info
              await executeQuery(
                'UPDATE broadcasts SET youtube_broadcast_id = ?, updated_at = datetime("now") WHERE broadcast_id = ?',
                [newBroadcastId, broadcastId]
              );

              // Update the streamkey record to point to the new broadcast (stream key stays the same)
              if (streamKeyRecordForRestream?.streamkey_id) {
                await executeQuery(
                  'UPDATE streamkeys SET youtube_broadcast_id = ?, youtube_stream_id = ?, updated_at = datetime("now"), last_used_at = datetime("now") WHERE streamkey_id = ?',
                  [newBroadcastId, existingYouTubeStreamId, streamKeyRecordForRestream.streamkey_id]
                );
              }

              console.log('💾 Updated database with new broadcast ID (reusing existing stream key)');

              console.log('🎯 Using stream key for FFmpeg (reused):', streamKey);
                
                // Update metadata (tags and category) if template has them
                if (templateSettings && (templateSettings.tags?.length > 0 || templateSettings.category)) {
                  try {
                    console.log('🔄 Updating broadcast metadata after creation...');
                    
                    // Wait a moment for YouTube to process the broadcast
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Get broadcast details to find videoId
                    const broadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
                      part: 'snippet,status',
                      id: newBroadcastId
                    });
                    
                    if (broadcastDetails.data.items && broadcastDetails.data.items.length > 0) {
                      const broadcastItem = broadcastDetails.data.items[0];
                      const videoId = broadcastItem.snippet?.videoId;
                      
                      if (videoId) {
                        console.log('🎬 Found videoId for metadata update:', videoId);
                        
                        const updateData = {
                          id: videoId,
                          snippet: {}
                        };
                        
                        // Add tags if available
                        if (templateSettings.tags && templateSettings.tags.length > 0) {
                          updateData.snippet.tags = templateSettings.tags;
                        }
                        
                        // Add category if available
                        if (templateSettings.category) {
                          updateData.snippet.categoryId = templateSettings.category;
                        }
                        
                        // Only update if we have metadata to update
                        if (Object.keys(updateData.snippet).length > 0) {
                          console.log('📤 Updating YouTube video metadata:', {
                            videoId,
                            tags: updateData.snippet.tags,
                            categoryId: updateData.snippet.categoryId
                          });
                          
                          await youtubeService.youtube.videos.update({
                            part: 'snippet',
                            requestBody: updateData
                          });
                          
                          console.log('✅ Successfully updated broadcast metadata');
                        } else {
                          console.log('ℹ️ No additional metadata to update');
                        }
                      } else {
                        console.warn('⚠️ VideoId not available yet, metadata update skipped');
                      }
                    }
                  } catch (metadataError) {
                    console.warn('⚠️ Failed to update metadata after creation:', metadataError.message);
                    // Continue - metadata update is optional
                  }
                }
                
                // Trigger metadata sync if template exists (for thumbnail and other updates)
                if (broadcast.template_uuid) {
                  const { addBroadcastForMetadataSync } = require('./metadataSyncService');
                  await addBroadcastForMetadataSync(broadcast.broadcast_uuid, newBroadcastId, broadcast.template_uuid, broadcast.channel_uuid);
                  console.log('📋 Queued metadata sync for new broadcast');
                }
            }
          } else {
            console.warn('⚠️ No OAuth credentials found for YouTube reconnection');
          }
        } else {
          console.warn('⚠️ No broadcast record found for reconnection check');
        }
      } catch (youtubeError) {
        console.error('❌ YouTube reconnection error:', youtubeError.message);
        console.error('📋 Full error details:', {
          message: youtubeError.message,
          errors: youtubeError.errors,
          code: youtubeError.code,
          status: youtubeError.status
        });
        
        // Log detailed error
        await logError('YouTube reconnection failed', { 
          broadcastId, 
          error: youtubeError.message,
          details: youtubeError.errors,
          code: youtubeError.code
        });
        
        // Continue with normal start - don't fail the entire broadcast
        console.log('⚠️ Continuing with normal broadcast start despite YouTube error');
      }
    }

    // Construct full destination URL, handling trailing slashes
    const baseUrl = destinationUrl.endsWith('/') 
      ? destinationUrl.slice(0, -1) 
      : destinationUrl;
    const fullDestinationUrl = streamKey 
      ? `${baseUrl}/${streamKey}`
      : baseUrl;

    // Special handling for Facebook: Wait for connection cleanup
    if (isFacebookStream(destinationUrl)) {
      console.log('⏳ Facebook stream detected. Waiting for connection cleanup...');
      await delay(3000); // Wait 3 seconds for FB to release previous connection
      await logInfo('Waiting for Facebook connection cleanup', { broadcastId, delay: '3s' });
    }

    // Check if video has audio stream
    const videoHasAudio = await hasAudioStream(videoFilePath);
    
    if (!videoHasAudio) {
      console.log(`⚠️  Video has no audio track. Generating silent audio for compatibility...`);
      await logInfo('Video has no audio, generating silent audio', { broadcastId });
    }

    // Get video resolution if not provided
    let videoResolution = { width: 1280, height: 720 }; // Default fallback
    try {
      videoResolution = await getVideoResolution(videoFilePath);
      console.log(`Video resolution detected: ${videoResolution.width}x${videoResolution.height}`);
    } catch (err) {
      console.warn('Could not detect video resolution, using default 1280x720');
    }

    // Determine output resolution
    // Priority: Advanced Settings resolution > original video resolution (min 480p) > default 720p
    let outputWidth, outputHeight;
    
    if (resolution && resolution !== 'auto' && resolution !== 'auto-detect') {
      // User specified resolution in Advanced Settings (e.g., "720p", "1080p")
      const resolutionMap = {
        '720p': { w: 1280, h: 720 },
        '1080p': { w: 1920, h: 1080 },
        '1440p': { w: 2560, h: 1440 },
        '2160p': { w: 3840, h: 2160 }
      };
      
      if (resolutionMap[resolution]) {
        outputWidth = resolutionMap[resolution].w;
        outputHeight = resolutionMap[resolution].h;
        console.log(`📐 Using Advanced Settings resolution: ${outputWidth}x${outputHeight} (${resolution})`);
      } else {
        // Fallback to video resolution
        outputWidth = videoResolution.width;
        outputHeight = videoResolution.height;
        console.log(`Using original video resolution: ${outputWidth}x${outputHeight}`);
      }
    } else {
      // Use original video resolution, but ensure minimum 480p
      outputWidth = videoResolution.width;
      outputHeight = videoResolution.height;
      
      // Ensure minimum height of 480px
      if (outputHeight < 480) {
        const scale = 480 / outputHeight;
        outputHeight = 480;
        outputWidth = Math.round(outputWidth * scale);
        // Ensure width is even number (required by x264)
        if (outputWidth % 2 !== 0) outputWidth++;
        console.log(`Upscaling to minimum 480p: ${outputWidth}x${outputHeight}`);
      } else {
        console.log(`Using original video resolution: ${outputWidth}x${outputHeight}`);
      }
    }

    await logInfo('Starting broadcast', { 
      broadcastId, 
      destination: destinationUrl,
      maxDuration: maxDurationSeconds ? `${maxDurationSeconds}s` : 'unlimited',
      hasAudio: videoHasAudio,
      resolution: `${outputWidth}x${outputHeight}`
    });

    // Input options - proven config + SAFER settings
    const inputOptions = [
      '-re',                               // Read input at native frame rate
      '-loglevel', 'verbose',              // VERBOSE logging to debug SIGSEGV
      '-fflags', '+genpts+igndts',         // Generate PTS + ignore DTS  
      '-avoid_negative_ts', 'make_zero',   // Fix timestamp issues
      '-analyzeduration', '2147483647',    // Max analyze duration
      '-probesize', '2147483647',          // Max probe size
      '-stream_loop', '-1'                 // Loop the video indefinitely
    ];

    // Calculate bitrate values from Advanced Settings
    // Bitrate format: "2500k", "3000k", "4500k", "6000k"
    const baseVideoBitrate = bitrate; // e.g., "2500k"
    const maxBitrate = bitrate.replace('k', '') * 1.5 + 'k'; // 1.5x for maxrate
    const bufferSize = bitrate.replace('k', '') * 2 + 'k'; // 2x for bufsize

    // Output options
    let outputOptions;
    if (Object.keys(advancedSettings).length === 0) {
      // No advanced settings: copy codec (no re-encode)
      outputOptions = [
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'flv'
      ];
    } else {
      // With advanced settings: re-encode
      // Adaptive Profile & Level
      let profile = "baseline";
      let level = "3.0";

      if (outputHeight >= 720) {
        profile = "main";
        level = "4.0";
      } else if (outputHeight >= 1080) {
        profile = "high";
        level = "4.2";
      }

      // Adaptive GOP (2 detik per FPS)
      const gop = frameRate * 2;

      outputOptions = [
        // ALWAYS re-encode with SAFE settings (no copy codec for now)
        '-c:v', 'libx264',                   // H.264 video codec
        // '-preset', 'ultrafast',             // Fastest encoding (less CPU)
        '-preset', 'veryfast',               // Faster encoding with better quality
        '-tune', 'zerolatency',              // Low latency
        '-profile:v', profile,               // BASELINE profile (most compatible)
        '-level', level,                     // Level 3.0 (compatible)
        '-b:v', baseVideoBitrate,            // Video bitrate
        '-maxrate', maxBitrate,              // Max bitrate
        '-bufsize', bufferSize,              // Buffer size
        '-pix_fmt', 'yuv420p',               // Pixel format
        '-g', String(gop),                   // GOP size (2 seconds at 30fps)
        '-r', String(frameRate),             // Frame rate
        '-filter:v', `fps=${frameRate}`,     // Force frame rate conversion
        '-s', `${outputWidth}x${outputHeight}`, // Output size
        // Audio codec will be set based on whether video has audio or not
        '-max_muxing_queue_size', '1024',    // Large muxing queue
        '-f', 'flv'                          // FLV format for RTMP
      ];
    }
    
    // Add duration limit if specified
    if (maxDurationSeconds && maxDurationSeconds > 0) {
      outputOptions.push('-t', maxDurationSeconds.toString());
      console.log(`Stream will automatically stop after ${maxDurationSeconds} seconds (${Math.floor(maxDurationSeconds / 60)} minutes)`);
    }

    // Create FFmpeg command for live streaming
    let ffmpegProcess;
    
    // If no audio, add silent audio source as additional input
    if (!videoHasAudio) {
      // When using .input(), fluent-ffmpeg adds them in reverse order
      // So anullsrc becomes input 0, video becomes input 1
      ffmpegProcess = ffmpeg('anullsrc=channel_layout=stereo:sample_rate=44100')
        .inputFormat('lavfi')
        .input(videoFilePath)
        .inputOptions(inputOptions);

      // Add mapping options to output
      // Input 0 = anullsrc (audio), Input 1 = video file
      outputOptions.push(
        '-map', '1:v',  // Map video from second input (video file)
        '-map', '0:a',  // Map audio from first input (anullsrc)
        '-c:a', 'aac',  // Ensure AAC codec is applied to the mapped audio
        '-b:a', '128k', // Audio bitrate
        '-ar', '44100', // Audio sample rate
        '-ac', '2',     // Stereo audio
        '-shortest'     // Stop when shortest input ends
      );
    } else {
      // Video has audio, use normal flow
      ffmpegProcess = ffmpeg(videoFilePath)
        .inputOptions(inputOptions);
    }

    // Add audio codec settings for all cases
    outputOptions.push(
      '-c:a', 'aac',  // AAC audio codec
      '-b:a', '128k', // Audio bitrate
      '-ar', '44100', // Audio sample rate
      '-ac', '2'      // Stereo audio
    );

    ffmpegProcess = ffmpegProcess
      .outputOptions(outputOptions)
      .output(fullDestinationUrl)
      .on('start', async (commandLine) => {
        console.log('FFmpeg command:', commandLine);
        console.log('Streaming to:', fullDestinationUrl);
        await Broadcast.updateStatus(broadcastId, 'active');
        await logInfo('Broadcast started successfully', { broadcastId });
      })
      .on('progress', (progress) => {
        // Log progress every 10 seconds to avoid spam
        if (progress.timemark) {
          const seconds = Math.floor(progress.timemark.split(':').reduce((acc, time) => (60 * acc) + +time));
          if (seconds % 10 === 0) {
            console.log(`[Broadcast ${broadcastId}] Progress: ${progress.timemark} | FPS: ${progress.currentFps || 'N/A'} | Bitrate: ${progress.currentKbps || 'N/A'}kbps`);
            // Track network quality if provided
            if (options && options.networkMonitor && progress.currentKbps) {
              options.networkMonitor.recordBitrate(progress.currentKbps);
            }
          }
        }
      })
      .on('error', async (err, stdout, stderr) => {
        const errorMsg = err.message || err.toString();
        const stderrStr = stderr || '';
        
        // Check if this is a user-initiated stop (SIGKILL/SIGTERM) or actual error
        const isUserStop = errorMsg.includes('killed with signal SIGKILL') || 
                          errorMsg.includes('killed with signal SIGTERM') ||
                          errorMsg.includes('received signal 15') ||
                          errorMsg.includes('signal 15') ||
                          stderrStr.includes('signal 15') ||
                          stderrStr.includes('received signal 15') ||
                          (err.code === 255 && (errorMsg.includes('signal') || stderrStr.includes('signal')));
        
        // Check for SIGSEGV (segmentation fault) - likely memory or codec issue
        const isSIGSEGV = errorMsg.includes('killed with signal SIGSEGV');
        
        // Check if this is a connection-related error for YouTube/RTMP
        const isConnectionError = StreamErrorDetector.isConnectionError(err, stderrStr);
        
        // Check if this is a Facebook connection error (needs retry)
        const isFBConnectionError = isFacebookStream(destinationUrl) && 
                                   (errorMsg.includes('Connection refused') ||
                                    errorMsg.includes('already publishing') ||
                                    errorMsg.includes('Stream not found') ||
                                    stderrStr.includes('Connection refused'));
        
        if (isUserStop) {
          // User stopped the broadcast manually
          console.log('Broadcast stopped by user');
          await logInfo('Broadcast stopped by user', { broadcastId });
          // Status will be set by stopLiveBroadcast function
        } else if (isSIGSEGV) {
          // SIGSEGV indicates ffmpeg crashed - memory or codec issue
          console.error('🔴 CRITICAL: ffmpeg crashed with SIGSEGV (segmentation fault)');
          console.error('   This usually indicates: insufficient memory, codec library issue, or corrupt video file');
          await logError('Broadcast SIGSEGV crash - memory or codec issue', { 
            broadcastId, 
            error: errorMsg,
            suggestion: 'Increase Docker memory, check video file, or reduce bitrate/resolution'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', 
            'FFmpeg crashed (SIGSEGV). Try reducing bitrate/resolution or increasing Docker memory.');
          
          // Send error notification
          if (userUuid) {
            try {
              const NotificationService = require('./notificationService');
              await NotificationService.sendToUserChannels(userUuid, 'error', {
                message: 'Broadcast failed - FFmpeg crashed (SIGSEGV)',
                details: 'This usually indicates insufficient memory, codec library issue, or corrupt video file. Try reducing bitrate/resolution or increasing Docker memory.'
              });
            } catch (notificationError) {
              console.error('Broadcast error notification failed:', notificationError);
            }
          }
        } else if (isFBConnectionError) {
          // Facebook connection error (likely previous connection not released)
          console.error('⚠️  Facebook connection error (previous stream may still be active):', errorMsg);
          await logError('Facebook connection error - retry needed', { 
            broadcastId, 
            error: errorMsg,
            suggestion: 'Wait 10-15 seconds before retrying'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', 
            'Facebook connection error. Please wait 10-15 seconds and try again.');
          
          // Send error notification
          if (userUuid) {
            try {
              const NotificationService = require('./notificationService');
              await NotificationService.sendToUserChannels(userUuid, 'error', {
                message: 'Broadcast failed - Facebook connection error',
                details: 'Previous stream may still be active. Please wait 10-15 seconds and try again.'
              });
            } catch (notificationError) {
              console.error('Broadcast error notification failed:', notificationError);
            }
          }
        } else if (isConnectionError) {
          // YouTube/RTMP connection error - should be retried by wrapper
          console.error('⚠️  Stream connection error (will retry automatically):', errorMsg);
          if (options && options.networkMonitor) {
            options.networkMonitor.recordReconnectAttempt();
          }
          // Re-throw to trigger retry logic in wrapper
          throw err;
        } else {
          // Other actual error occurred
          console.error('Broadcast error:', errorMsg);
          await logError('Broadcast failed', { 
            broadcastId, 
            error: errorMsg,
            stderr: stderrStr,
            networkStatus: options && options.networkMonitor ? options.networkMonitor.getStatus() : null
          });
          await Broadcast.updateStatus(broadcastId, 'failed', errorMsg);
          
          // Send error notification
          if (userUuid) {
            try {
              const NotificationService = require('./notificationService');
              await NotificationService.sendToUserChannels(userUuid, 'error', {
                message: 'Broadcast failed',
                details: errorMsg
              });
            } catch (notificationError) {
              console.error('Broadcast error notification failed:', notificationError);
            }
          }
        }
        activeBroadcastProcesses.delete(broadcastId);
      })
      .on('end', async () => {
        console.log('Broadcast ended');
        await logInfo('Broadcast completed', { broadcastId });
        await Broadcast.updateStatus(broadcastId, 'completed');
        activeBroadcastProcesses.delete(broadcastId);
      });

    // Start the FFmpeg process
    ffmpegProcess.run();

    // Store the process reference
    activeBroadcastProcesses.set(broadcastId, ffmpegProcess);

    return { success: true, message: 'Broadcast started' };
  } catch (error) {
    await logError('Failed to start broadcast', { 
      broadcastId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Stop a live broadcast with proper cleanup
 */
async function stopLiveBroadcast(broadcastId) {
  try {
    const ffmpegProcess = activeBroadcastProcesses.get(broadcastId);

    if (!ffmpegProcess) {
      // Check if broadcast is still marked as active in DB
      const broadcast = await Broadcast.findById(broadcastId);
      if (broadcast && broadcast.broadcast_status === 'active') {
        console.log(`⚠️ No active process found for broadcast ${broadcastId}, but DB shows active. Updating status to stopped.`);
        await Broadcast.updateStatus(broadcastId, 'stopped');
        await logInfo('Broadcast status updated to stopped (no active process)', { broadcastId });
        return { success: true, message: 'Broadcast status updated to stopped' };
      }
      throw new Error('Broadcast is not active');
    }

    // Kill the FFmpeg process gracefully first, then force if needed
    try {
      ffmpegProcess.kill('SIGTERM'); // Try graceful shutdown first
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If still running, force kill
      if (activeBroadcastProcesses.has(broadcastId)) {
        ffmpegProcess.kill('SIGKILL');
      }
    } catch (killError) {
      console.warn('Error killing FFmpeg process:', killError.message);
      // Try force kill anyway
      try {
        ffmpegProcess.kill('SIGKILL');
      } catch (forceKillError) {
        console.warn('Force kill also failed:', forceKillError.message);
      }
    }
    
    activeBroadcastProcesses.delete(broadcastId);

    await Broadcast.updateStatus(broadcastId, 'stopped');
    await logInfo('Broadcast stopped', { broadcastId });

    return { success: true, message: 'Broadcast stopped' };
  } catch (error) {
    await logError('Failed to stop broadcast', { 
      broadcastId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Check if broadcast is active
 */
function isBroadcastActive(broadcastId) {
  return activeBroadcastProcesses.has(broadcastId);
}

/**
 * Get active broadcast count
 */
function getActiveBroadcastCount() {
  return activeBroadcastProcesses.size;
}

/**
 * Get all active broadcast IDs
 */
function getActiveBroadcastIds() {
  return Array.from(activeBroadcastProcesses.keys());
}

/**
 * Stop all broadcasts
 */
async function stopAllBroadcasts() {
  const broadcastIds = Array.from(activeBroadcastProcesses.keys());
  
  for (const broadcastId of broadcastIds) {
    try {
      await stopLiveBroadcast(broadcastId);
    } catch (error) {
      console.error(`Error stopping broadcast ${broadcastId}:`, error.message);
    }
  }

  await logInfo('All broadcasts stopped', { count: broadcastIds.length });
}

/**
 * Restart a broadcast
 */
async function restartBroadcast(broadcastId, videoFilePath, destinationUrl, streamKey) {
  try {
    // Stop if already running
    if (isBroadcastActive(broadcastId)) {
      await stopLiveBroadcast(broadcastId);
      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Start again
    return await startLiveBroadcast(broadcastId, videoFilePath, destinationUrl, streamKey);
  } catch (error) {
    await logError('Failed to restart broadcast', { 
      broadcastId, 
      error: error.message 
    });
    throw error;
  }
}

// Cleanup on process termination
process.on('SIGINT', async () => {
  console.log('\nShutting down broadcasts...');
  await stopAllBroadcasts();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down broadcasts...');
  await stopAllBroadcasts();
  process.exit(0);
});

module.exports = {
  startLiveBroadcast,
  startPlaylistBroadcast,
  stopLiveBroadcast,
  isBroadcastActive,
  getActiveBroadcastCount,
  getActiveBroadcastIds,
  stopAllBroadcasts,
  restartBroadcast,
  broadcastWithAutoReconnect
};
