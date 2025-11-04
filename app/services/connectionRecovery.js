/**
 * Connection Recovery & Health Monitoring Module
 * Handles FFmpeg stream disconnections and automatic reconnection for YouTube
 */

const { logInfo, logError } = require('./activityLogger');

/**
 * Connection health monitoring
 */
class ConnectionHealthMonitor {
  constructor(broadcastId) {
    this.broadcastId = broadcastId;
    this.lastProgressTime = Date.now();
    this.stuckThreshold = 30000; // 30 seconds without progress = stuck
    this.bitrate = 0;
    this.fps = 0;
    this.lastTimestamp = '0:0:0';
    this.errorCount = 0;
    this.maxErrors = 5;
    this.isHealthy = true;
    this.statusCheckInterval = null;
  }

  updateProgress(progress) {
    if (progress && progress.timemark) {
      this.lastProgressTime = Date.now();
      this.lastTimestamp = progress.timemark;
      this.bitrate = progress.currentKbps || 0;
      this.fps = progress.currentFps || 0;
    }
  }

  recordError() {
    this.errorCount++;
    if (this.errorCount >= this.maxErrors) {
      this.isHealthy = false;
      logError(`Connection degraded: ${this.errorCount} errors detected`, {
        broadcastId: this.broadcastId
      });
    }
  }

  isStuck() {
    return (Date.now() - this.lastProgressTime) > this.stuckThreshold;
  }

  reset() {
    this.errorCount = 0;
    this.isHealthy = true;
  }

  getStatus() {
    return {
      isHealthy: this.isHealthy,
      isStuck: this.isStuck(),
      errorCount: this.errorCount,
      lastUpdate: new Date(this.lastProgressTime).toISOString(),
      bitrate: this.bitrate,
      fps: this.fps,
      lastTimestamp: this.lastTimestamp
    };
  }

  startMonitoring(callback) {
    this.statusCheckInterval = setInterval(() => {
      if (this.isStuck()) {
        callback({ type: 'stuck', message: 'Stream appears to be stuck' });
      }
    }, 10000); // Check every 10 seconds
  }

  stopMonitoring() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }
}

/**
 * Exponential backoff retry strategy
 */
class RetryStrategy {
  constructor(maxRetries = 5) {
    this.maxRetries = maxRetries;
    this.attempts = 0;
    this.retryLog = [];
  }

  getDelay() {
    // Exponential backoff: 2^attempts * 1000ms, capped at 60 seconds
    return Math.min(Math.pow(2, this.attempts) * 1000, 60000);
  }

  async waitBeforeRetry() {
    const delay = this.getDelay();
    console.log(`⏳ Retry attempt ${this.attempts + 1}/${this.maxRetries} - waiting ${delay/1000}s...`);
    
    this.retryLog.push({
      attempt: this.attempts + 1,
      delay,
      timestamp: new Date().toISOString()
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    this.attempts++;
  }

  canRetry() {
    return this.attempts < this.maxRetries;
  }

  reset() {
    this.attempts = 0;
    this.retryLog = [];
  }

  isMaxAttemptsReached() {
    return this.attempts >= this.maxRetries;
  }

  getLog() {
    return this.retryLog;
  }
}

/**
 * FFmpeg stream error detector
 */
class StreamErrorDetector {
  static isConnectionError(error, stderr = '') {
    const errorStr = (error.message || error.toString()).toLowerCase();
    const stderrStr = (stderr || '').toLowerCase();
    const combined = errorStr + stderrStr;

    // YouTube specific connection errors
    const youtubeErrors = [
      'connection refused',
      'connection reset',
      'broken pipe',
      'stream key rejected',
      'invalid stream key',
      'http error',
      'timeout',
      'reset by peer',
      'network is unreachable',
      'no route to host'
    ];

    return youtubeErrors.some(err => combined.includes(err));
  }

  static isFatalError(error, stderr = '') {
    const errorStr = (error.message || error.toString()).toLowerCase();
    const stderrStr = (stderr || '').toLowerCase();
    const combined = errorStr + stderrStr;

    // Fatal errors that shouldn't be retried
    const fatalErrors = [
      'no such file',
      'permission denied',
      'invalid data found',
      'unrecognized option',
      'unknown encoder'
    ];

    return fatalErrors.some(err => combined.includes(err));
  }

  static isMemoryError(error, stderr = '') {
    const errorStr = (error.message || error.toString()).toLowerCase();
    const stderrStr = (stderr || '').toLowerCase();
    const combined = errorStr + stderrStr;

    return combined.includes('cannot allocate memory') ||
           combined.includes('out of memory') ||
           combined.includes('segmentation fault');
  }

  static getSuggestedBitrate(currentBitrate) {
    // Parse current bitrate and reduce by 20%
    const match = currentBitrate.match(/(\d+)/);
    if (match) {
      const current = parseInt(match[1]);
      const reduced = Math.max(500, Math.round(current * 0.8)); // Min 500k
      return `${reduced}k`;
    }
    return '1500k'; // Fallback
  }
}

/**
 * Network quality monitor
 */
class NetworkQualityMonitor {
  constructor(broadcastId) {
    this.broadcastId = broadcastId;
    this.samples = [];
    this.maxSamples = 60; // Keep last 60 samples
    this.droppedFrames = 0;
    this.reconnectAttempts = 0;
  }

  recordBitrate(bitrate) {
    this.samples.push({
      bitrate: bitrate || 0,
      timestamp: Date.now()
    });

    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  getAverageBitrate() {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, s) => acc + s.bitrate, 0);
    return Math.round(sum / this.samples.length);
  }

  getBitrateVariance() {
    if (this.samples.length < 2) return 0;
    const avg = this.getAverageBitrate();
    const variance = this.samples.reduce((acc, s) => {
      return acc + Math.pow(s.bitrate - avg, 2);
    }, 0) / this.samples.length;
    return Math.sqrt(variance);
  }

  isNetworkUnstable() {
    const variance = this.getBitrateVariance();
    const avg = this.getAverageBitrate();
    
    // If variance is > 30% of average, network is unstable
    return (variance / avg) > 0.3;
  }

  recordDroppedFrames(count) {
    this.droppedFrames += count;
  }

  recordReconnectAttempt() {
    this.reconnectAttempts++;
  }

  getStatus() {
    return {
      averageBitrate: this.getAverageBitrate(),
      bitrateVariance: Math.round(this.getBitrateVariance()),
      isUnstable: this.isNetworkUnstable(),
      droppedFrames: this.droppedFrames,
      reconnectAttempts: this.reconnectAttempts,
      sampleCount: this.samples.length
    };
  }
}

module.exports = {
  ConnectionHealthMonitor,
  RetryStrategy,
  StreamErrorDetector,
  NetworkQualityMonitor
};
