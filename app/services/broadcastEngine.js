const ffmpeg = require('fluent-ffmpeg');
const { logInfo, logError } = require('./activityLogger');
const Broadcast = require('../models/Broadcast');
const ffmpegErrorHandler = require('./ffmpegErrorHandler');

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
 * Start live broadcast with playlist (multiple videos)
 * @param {number} broadcastId - Broadcast ID
 * @param {Array} videos - Array of video objects with filepath
 * @param {string} destinationUrl - RTMP destination URL
 * @param {string} streamKey - Stream key
 * @param {boolean} shuffle - Whether to shuffle videos
 * @param {boolean} loop - Whether to loop playlist
 * @param {object} advancedSettings - Advanced Settings (bitrate, frame_rate, resolution, orientation)
 */
async function startPlaylistBroadcast(broadcastId, videos, destinationUrl, streamKey, shuffle = false, loop = true, advancedSettings = {}) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Parse Advanced Settings
    const bitrate = advancedSettings.bitrate || '2500k';
    const frameRate = advancedSettings.frame_rate || 30;
    const resolution = advancedSettings.resolution || null;
    const orientation = advancedSettings.orientation || 'landscape';
    
    console.log(`📊 Advanced Settings (Playlist): Bitrate=${bitrate}, FPS=${frameRate}, Resolution=${resolution}, Orientation=${orientation}`);
    
    // Check if broadcast is already running
    if (activeBroadcastProcesses.has(broadcastId)) {
      throw new Error('Broadcast is already active');
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

    // Output options - FORCE RE-ENCODE for now (safer than copy codec)
    const outputOptions = [
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
      '-c:a', 'aac',                       // AAC audio codec
      '-b:a', '128k',                      // Audio bitrate
      '-ar', '44100',                      // Audio sample rate
      '-ac', '2',                          // Stereo audio
      '-max_muxing_queue_size', '1024',    // Large muxing queue
      '-f', 'flv'                          // FLV format
    ];

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
        } else {
          console.error('Playlist broadcast error:', err.message);
          await logError('Playlist broadcast failed', { 
            broadcastId, 
            error: err.message,
            stderr: stderr || 'N/A'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', err.message);
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

async function startLiveBroadcast(broadcastId, videoFilePath, destinationUrl, streamKey, maxDurationSeconds = null, advancedSettings = {}) {
  try {
    // Check if broadcast is already running
    if (activeBroadcastProcesses.has(broadcastId)) {
      throw new Error('Broadcast is already active');
    }

    // Parse Advanced Settings
    // bitrate format: "2500k", frame_rate: "30", resolution: "720p", orientation: "landscape"
    const bitrate = advancedSettings.bitrate || '2500k';
    const frameRate = advancedSettings.frame_rate || 30;
    const resolution = advancedSettings.resolution || null;
    const orientation = advancedSettings.orientation || 'landscape';
    
    console.log(`📊 Advanced Settings: Bitrate=${bitrate}, FPS=${frameRate}, Resolution=${resolution}, Orientation=${orientation}`);

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
    // Determine whether user provided any advanced settings
    const usingAdvancedSettings = advancedSettings && (
      advancedSettings.bitrate ||
      advancedSettings.frame_rate ||
      advancedSettings.resolution
    );

    // Start with defaults from advancedSettings (or fallbacks defined earlier)
    let outputWidth, outputHeight;
    let baseVideoBitrate = bitrate; // string like "2500k"
    let usedFrameRate = frameRate;

    if (!usingAdvancedSettings) {
      // No advanced settings provided => prefer original video's bitrate, frame rate and resolution
      try {
      const probe = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoFilePath, (err, metadata) => err ? reject(err) : resolve(metadata));
      });

      const videoStream = probe.streams.find(s => s.codec_type === 'video');

      // Frame rate: prefer avg_frame_rate, fallback to r_frame_rate
      if (videoStream) {
        const fpsStr = videoStream.avg_frame_rate || videoStream.r_frame_rate || String(frameRate);
        let fps = Number(frameRate);
        if (fpsStr && typeof fpsStr === 'string' && fpsStr.includes('/')) {
        const [num, den] = fpsStr.split('/').map(Number);
        if (den && !Number.isNaN(num) && !Number.isNaN(den)) fps = num / den;
        } else if (fpsStr) {
        const n = Number(fpsStr);
        if (!Number.isNaN(n)) fps = n;
        }
        usedFrameRate = Math.max(1, Math.round(fps));

        // Bitrate: prefer stream bit_rate, fallback to format bit_rate
        const bitRateNum = (videoStream.bit_rate && Number(videoStream.bit_rate)) ||
                 (probe.format && probe.format.bit_rate && Number(probe.format.bit_rate)) ||
                 null;
        if (bitRateNum && !Number.isNaN(bitRateNum) && bitRateNum > 0) {
        // Convert to "NNNk"
        const kbps = Math.max(200, Math.round(bitRateNum / 1000)); // enforce a sensible minimum
        baseVideoBitrate = `${kbps}k`;
        }

        // Resolution from probed stream (fallback to earlier getVideoResolution result)
        if (videoStream.width && videoStream.height) {
        outputWidth = videoStream.width;
        outputHeight = videoStream.height;
        }
      }
      } catch (probeErr) {
      console.warn('Could not probe video for defaults, falling back to configured defaults:', probeErr.message);
      }

      // If probe didn't set resolution, use previously-detected videoResolution (from getVideoResolution)
      if (!outputWidth || !outputHeight) {
      outputWidth = videoResolution.width || 1280;
      outputHeight = videoResolution.height || 720;
      }

      // Ensure minimum height of 480px
      if (outputHeight < 480) {
      const scale = 480 / outputHeight;
      outputHeight = 480;
      outputWidth = Math.round(outputWidth * scale);
      }

      // Ensure width is even (required by many encoders)
      if (outputWidth % 2 !== 0) outputWidth++;

      console.log(`Using original video defaults -> Resolution: ${outputWidth}x${outputHeight}, FPS: ${usedFrameRate}, Bitrate: ${baseVideoBitrate}`);
    } else {
      // User provided advanced settings (use them, with fallbacks)
      if (resolution && resolution !== 'auto' && resolution !== 'auto-detect') {
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
        outputWidth = videoResolution.width;
        outputHeight = videoResolution.height;
        console.log(`Using original video resolution: ${outputWidth}x${outputHeight}`);
      }
      } else {
      outputWidth = videoResolution.width;
      outputHeight = videoResolution.height;

      if (outputHeight < 480) {
        const scale = 480 / outputHeight;
        outputHeight = 480;
        outputWidth = Math.round(outputWidth * scale);
        if (outputWidth % 2 !== 0) outputWidth++;
        console.log(`Upscaling to minimum 480p: ${outputWidth}x${outputHeight}`);
      } else {
        console.log(`Using original video resolution: ${outputWidth}x${outputHeight}`);
      }
      }

      // If user provided a bitrate/frame_rate, respect them
      if (advancedSettings.bitrate) baseVideoBitrate = advancedSettings.bitrate;
      if (advancedSettings.frame_rate) usedFrameRate = advancedSettings.frame_rate;

      // Ensure width even
      if (outputWidth % 2 !== 0) outputWidth++;
    }

    await logInfo('Starting broadcast', { 
      broadcastId, 
      destination: destinationUrl,
      maxDuration: maxDurationSeconds ? `${maxDurationSeconds}s` : 'unlimited',
      hasAudio: videoHasAudio,
      resolution: `${outputWidth}x${outputHeight}`,
      frameRate: usedFrameRate,
      bitrate: baseVideoBitrate
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

    // Calculate bitrate values from chosen baseVideoBitrate
    const maxBitrate = (Number(baseVideoBitrate.replace('k', '')) * 1.5) + 'k';
    const bufferSize = (Number(baseVideoBitrate.replace('k', '')) * 2) + 'k';

    // Output options - FORCE RE-ENCODE for now (safer than copy codec)
<<<<<<< HEAD
    const outputOptions = [
      '-c:v', 'libx264',                   // H.264 video codec
      '-preset', 'ultrafast',              // Fastest encoding (less CPU)
      '-tune', 'zerolatency',              // Low latency
      '-profile:v', 'baseline',            // BASELINE profile (most compatible)
      '-level', '3.0',                     // Level 3.0 (compatible)
      '-b:v', baseVideoBitrate,            // Video bitrate
      '-maxrate', maxBitrate,              // Max bitrate
      '-bufsize', bufferSize,              // Buffer size
      '-pix_fmt', 'yuv420p',               // Pixel format
      '-g', '60',                          // GOP size (2 seconds at 30fps)
      '-r', String(usedFrameRate),         // Frame rate
      '-s', `${outputWidth}x${outputHeight}`, // Output size
      '-c:a', 'aac',                       // AAC audio codec
      '-b:a', '128k',                      // Audio bitrate
      '-ar', '44100',                      // Audio sample rate
      '-ac', '2',                          // Stereo audio
      '-max_muxing_queue_size', '1024',    // Large muxing queue
      '-f', 'flv'                          // FLV format for RTMP
    ];
    
=======
    // TODO: Test copy codec after confirming re-encode works
    // CPU-friendly output options: prefer hardware encoder if enabled, otherwise use very fast x264 preset
    let outputOptions = [];
    const hwAccel = process.env.FFMPEG_HW_ACCEL || ""; // set to 'nvenc' or 'vaapi' in env to enable hardware accel

    if (hwAccel === "nvenc") {
      // NVENC hardware encoder (NVIDIA). Offloads CPU to GPU.
      outputOptions.push(
        "-c:v",
        "h264_nvenc",
        // nvenc presets vary by driver; "fast" is a reasonable balance (lower CPU)
        "-preset",
        "fast",
        "-b:v",
        baseVideoBitrate,
        "-maxrate",
        maxBitrate,
        "-bufsize",
        bufferSize,
        "-pix_fmt",
        "yuv420p",
        "-r",
        String(frameRate),
        "-s",
        `${outputWidth}x${outputHeight}`,
        // audio
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-f",
        "flv"
      );
    } else if (hwAccel === "vaapi") {
      // VAAPI (Intel/AMD) hardware encoder. Requires proper VAAPI setup in the container/host.
      // Note: when using vaapi you normally need to upload to hardware frames via vf filters.
      outputOptions.push(
        "-hwaccel",
        "vaapi",
        "-hwaccel_output_format",
        "vaapi",
        "-c:v",
        "h264_vaapi",
        "-vf",
        `scale=${outputWidth}:${outputHeight},format=nv12,hwupload`,
        "-b:v",
        baseVideoBitrate,
        "-maxrate",
        maxBitrate,
        "-bufsize",
        bufferSize,
        "-r",
        String(frameRate),
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-f",
        "flv"
      );
    } else {
      // CPU encode path (x264) - use veryfast/ultrafast to minimize CPU usage.
      // ultrafast uses least CPU but larger bitrate; veryfast is a compromise.
      const x264Preset = process.env.FFMPEG_X264_PRESET || "veryfast";
      // Optionally limit encoder threads to reduce CPU spikes (set THREAD_LIMIT env to control)
      const threadLimit = process.env.FFMPEG_THREAD_LIMIT || "1";

      outputOptions = [
        "-c:v",
        "libx264",
        "-preset",
        x264Preset, // veryfast/ultrafast for lower CPU usage
        "-tune",
        "zerolatency",
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-b:v",
        baseVideoBitrate,
        "-maxrate",
        maxBitrate,
        "-bufsize",
        bufferSize,
        "-pix_fmt",
        "yuv420p",
        "-g",
        "60",
        "-r",
        String(frameRate),
        "-s",
        `${outputWidth}x${outputHeight}`,
        "-threads",
        threadLimit, // limit threads to reduce CPU usage (default 1)
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-max_muxing_queue_size",
        "1024",
        "-f",
        "flv",
      ];
    }

>>>>>>> e3e3ee7ac35ba48aff359997d3455295dc47a28d
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
        '-shortest'     // Stop when shortest input ends
      );
    } else {
      // Video has audio, use normal flow
      ffmpegProcess = ffmpeg(videoFilePath)
        .inputOptions(inputOptions);
    }
    
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
          }
        }
      })
      .on('error', async (err, stdout, stderr) => {
        // Check if this is a user-initiated stop (SIGKILL/SIGTERM) or actual error
        const isUserStop = err.message.includes('killed with signal SIGKILL') || 
                          err.message.includes('killed with signal SIGTERM');
        
        // Check for SIGSEGV (segmentation fault) - likely memory or codec issue
        const isSIGSEGV = err.message.includes('killed with signal SIGSEGV');
        
        // Check if this is a Facebook connection error (needs retry)
        const isFBConnectionError = isFacebookStream(destinationUrl) && 
                                   (err.message.includes('Connection refused') ||
                                    err.message.includes('already publishing') ||
                                    err.message.includes('Stream not found') ||
                                    stderr.includes('Connection refused'));
        
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
            error: err.message,
            suggestion: 'Increase Docker memory, check video file, or reduce bitrate/resolution'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', 
            'FFmpeg crashed (SIGSEGV). Try reducing bitrate/resolution or increasing Docker memory.');
        } else if (isFBConnectionError) {
          // Facebook connection error (likely previous connection not released)
          console.error('⚠️  Facebook connection error (previous stream may still be active):', err.message);
          await logError('Facebook connection error - retry needed', { 
            broadcastId, 
            error: err.message,
            suggestion: 'Wait 10-15 seconds before retrying'
          });
          await Broadcast.updateStatus(broadcastId, 'failed', 
            'Facebook connection error. Please wait 10-15 seconds and try again.');
        } else {
          // Other actual error occurred
          console.error('Broadcast error:', err.message);
          await logError('Broadcast failed', { 
            broadcastId, 
            error: err.message,
            stderr: stderr
          });
          await Broadcast.updateStatus(broadcastId, 'failed', err.message);
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
  restartBroadcast
};
