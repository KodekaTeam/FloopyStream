const si = require('systeminformation');
const os = require('os');
const osUtils = require('os-utils');

/**
 * Performance Monitor Service
 * Monitors system performance metrics
 */

let performanceData = {
  cpu: 0,
  memory: { used: 0, total: 0, percentage: 0 },
  disk: { used: 0, total: 0, percentage: 0 },
  uptime: 0,
  timestamp: Date.now()
};

/**
 * Get CPU usage percentage
 */
function getCpuUsage() {
  return new Promise((resolve) => {
    osUtils.cpuUsage((usage) => {
      resolve(Math.round(usage * 100));
    });
  });
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const percentage = Math.round((usedMemory / totalMemory) * 100);

  return {
    used: usedMemory,
    total: totalMemory,
    free: freeMemory,
    percentage
  };
}

/**
 * Get disk usage
 */
async function getDiskUsage() {
  try {
    const fsSize = await si.fsSize();
    
    if (fsSize && fsSize.length > 0) {
      const mainDrive = fsSize[0];
      return {
        used: mainDrive.used,
        total: mainDrive.size,
        free: mainDrive.available,
        percentage: Math.round(mainDrive.use)
      };
    }
  } catch (error) {
    console.error('Error getting disk usage:', error.message);
  }

  return { used: 0, total: 0, free: 0, percentage: 0 };
}

/**
 * Get system uptime
 */
function getSystemUptime() {
  return os.uptime();
}

/**
 * Get network statistics
 */
async function getNetworkStats() {
  try {
    const networkStats = await si.networkStats();
    
    if (networkStats && networkStats.length > 0) {
      const mainInterface = networkStats[0];
      return {
        rx_sec: mainInterface.rx_sec || 0,
        tx_sec: mainInterface.tx_sec || 0,
        rx_bytes: mainInterface.rx_bytes || 0,
        tx_bytes: mainInterface.tx_bytes || 0
      };
    }
  } catch (error) {
    console.error('Error getting network stats:', error.message);
  }

  return { rx_sec: 0, tx_sec: 0, rx_bytes: 0, tx_bytes: 0 };
}

/**
 * Update performance metrics
 */
async function updateMetrics() {
  try {
    const [cpu, memory, disk] = await Promise.all([
      getCpuUsage(),
      Promise.resolve(getMemoryUsage()),
      getDiskUsage()
    ]);

    performanceData = {
      cpu,
      memory,
      disk,
      uptime: getSystemUptime(),
      timestamp: Date.now()
    };

    return performanceData;
  } catch (error) {
    console.error('Error updating metrics:', error.message);
    return performanceData;
  }
}

/**
 * Get current performance data
 */
function getCurrentMetrics() {
  return performanceData;
}

/**
 * Get system information
 */
async function getSystemInfo() {
  try {
    const [cpu, osInfo, mem] = await Promise.all([
      si.cpu(),
      si.osInfo(),
      si.mem()
    ]);

    return {
      platform: os.platform(),
      hostname: os.hostname(),
      cpuModel: cpu.manufacturer + ' ' + cpu.brand,
      cpuCores: cpu.cores,
      osType: osInfo.distro,
      osVersion: osInfo.release,
      totalMemory: mem.total,
      nodeVersion: process.version
    };
  } catch (error) {
    console.error('Error getting system info:', error.message);
    return null;
  }
}

/**
 * Start performance monitoring
 */
function startMonitoring(intervalSeconds = 5) {
  console.log(`✓ Performance monitoring started (interval: ${intervalSeconds}s)`);
  
  // Initial update
  updateMetrics();
  
  // Set up periodic updates
  const monitoringInterval = setInterval(() => {
    updateMetrics();
  }, intervalSeconds * 1000);

  return monitoringInterval;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  updateMetrics,
  getCurrentMetrics,
  getSystemInfo,
  getCpuUsage,
  getMemoryUsage,
  getDiskUsage,
  getNetworkStats,
  startMonitoring,
  formatBytes
};
