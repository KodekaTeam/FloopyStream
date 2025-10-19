/**
 * FFmpeg Error Handler and Stability Manager
 * Prevents SIGSEGV crashes and provides better error recovery
 */

const { logError, logInfo } = require('./activityLogger');

class FFmpegErrorHandler {
  constructor() {
    this.crashCount = 0;
    this.lastCrashTime = null;
    this.maxCrashes = 3;
    this.cooldownPeriod = 60000; // 1 minute
  }

  /**
   * Wrap FFmpeg command with error handling
   */
  wrapFFmpegCommand(ffmpegCommand, description = 'FFmpeg operation') {
    return new Promise((resolve, reject) => {
      if (this.shouldPreventExecution()) {
        const error = new Error(`FFmpeg temporarily disabled due to repeated crashes (${this.crashCount}/${this.maxCrashes})`);
        logError('FFmpeg disabled', { reason: error.message });
        reject(error);
        return;
      }

      // Set up process monitoring
      let hasResolved = false;
      const timeoutMs = 300000; // 5 minutes timeout

      const cleanup = () => {
        if (ffmpegCommand && ffmpegCommand.ffmpegProc) {
          try {
            ffmpegCommand.ffmpegProc.kill('SIGTERM');
            setTimeout(() => {
              if (ffmpegCommand.ffmpegProc && !ffmpegCommand.ffmpegProc.killed) {
                ffmpegCommand.ffmpegProc.kill('SIGKILL');
              }
            }, 5000);
          } catch (err) {
            logError('Error cleaning up FFmpeg process', { error: err.message });
          }
        }
      };

      // Set timeout
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          const error = new Error(`FFmpeg operation timeout after ${timeoutMs/1000}s: ${description}`);
          logError('FFmpeg timeout', { description, timeout: timeoutMs });
          reject(error);
        }
      }, timeoutMs);

      // Handle success
      ffmpegCommand
        .on('end', () => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            logInfo('FFmpeg operation completed', { description });
            resolve();
          }
        })
        .on('error', (err) => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            this.handleFFmpegError(err, description);
            reject(err);
          }
        })
        .on('stderr', (stderrLine) => {
          // Monitor for specific error patterns
          if (this.isSignificantError(stderrLine)) {
            logError('FFmpeg stderr warning', { 
              description, 
              stderr: stderrLine,
              timestamp: new Date().toISOString()
            });
          }
        });

      // Handle process signals that might indicate SIGSEGV
      if (ffmpegCommand.ffmpegProc) {
        ffmpegCommand.ffmpegProc.on('exit', (code, signal) => {
          if (signal === 'SIGSEGV' || code === 139) {
            this.handleSIGSEGV(description);
          }
        });
      }
    });
  }

  /**
   * Handle SIGSEGV specifically
   */
  handleSIGSEGV(description) {
    this.crashCount++;
    this.lastCrashTime = Date.now();
    
    logError('FFmpeg SIGSEGV detected', {
      description,
      crashCount: this.crashCount,
      maxCrashes: this.maxCrashes,
      recommendation: this.getSIGSEGVRecommendation()
    });

    // If too many crashes, disable FFmpeg temporarily
    if (this.crashCount >= this.maxCrashes) {
      logError('FFmpeg disabled due to repeated SIGSEGV crashes', {
        crashCount: this.crashCount,
        cooldownPeriod: this.cooldownPeriod
      });
    }
  }

  /**
   * Handle general FFmpeg errors
   */
  handleFFmpegError(error, description) {
    const errorMessage = error.message || error.toString();
    
    // Check for common FFmpeg issues
    if (errorMessage.includes('SIGSEGV') || errorMessage.includes('Segmentation fault')) {
      this.handleSIGSEGV(description);
    } else if (errorMessage.includes('No space left on device')) {
      logError('FFmpeg disk space error', { description, error: errorMessage });
    } else if (errorMessage.includes('Cannot allocate memory')) {
      logError('FFmpeg memory error', { description, error: errorMessage });
    } else {
      logError('FFmpeg operation failed', { description, error: errorMessage });
    }
  }

  /**
   * Check if FFmpeg execution should be prevented
   */
  shouldPreventExecution() {
    if (this.crashCount < this.maxCrashes) {
      return false;
    }

    if (this.lastCrashTime && (Date.now() - this.lastCrashTime) > this.cooldownPeriod) {
      // Reset crash count after cooldown period
      this.crashCount = 0;
      this.lastCrashTime = null;
      logInfo('FFmpeg crash counter reset after cooldown period');
      return false;
    }

    return true;
  }

  /**
   * Check if stderr line indicates significant error
   */
  isSignificantError(stderrLine) {
    const significantPatterns = [
      'SIGSEGV',
      'Segmentation fault',
      'Invalid data found',
      'No such file or directory',
      'Permission denied',
      'Cannot allocate memory',
      'No space left on device'
    ];

    return significantPatterns.some(pattern => 
      stderrLine.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Get recommendation for SIGSEGV issues
   */
  getSIGSEGVRecommendation() {
    return {
      'Immediate actions': [
        'Check Docker memory limits (increase to 4GB+)',
        'Verify system FFmpeg is being used instead of @ffmpeg-installer',
        'Reduce video resolution/bitrate',
        'Check disk space availability'
      ],
      'Docker settings': [
        'mem_limit: 6G',
        'memswap_limit: 6G',
        'Increase ulimits for memory',
        'Use system FFmpeg: /usr/bin/ffmpeg'
      ],
      'Code fixes': [
        'Use environment-based FFmpeg path detection',
        'Implement proper process cleanup',
        'Add timeouts to FFmpeg operations',
        'Remove @ffmpeg-installer from production'
      ]
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      crashCount: this.crashCount,
      maxCrashes: this.maxCrashes,
      lastCrashTime: this.lastCrashTime,
      isDisabled: this.shouldPreventExecution(),
      cooldownRemaining: this.lastCrashTime 
        ? Math.max(0, this.cooldownPeriod - (Date.now() - this.lastCrashTime))
        : 0
    };
  }
}

// Export singleton instance
module.exports = new FFmpegErrorHandler();