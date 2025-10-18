const fs = require('fs-extra');
const path = require('path');

/**
 * Activity Logger Service
 * Logs application activities to file
 */

const logDirectory = process.env.LOG_DIR || './storage/logs';
const logFile = path.join(logDirectory, 'application.log');

/**
 * Ensure log directory exists
 */
async function ensureLogDirectory() {
  try {
    await fs.ensureDir(logDirectory);
  } catch (error) {
    console.error('Failed to create log directory:', error.message);
  }
}

/**
 * Write log entry
 */
async function writeLogEntry(level, message, metadata = {}) {
  try {
    await ensureLogDirectory();
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logFile, logLine);
    
    // Also log to console
    const consoleMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(consoleMessage, metadata);
        break;
      case 'warn':
        console.warn(consoleMessage, metadata);
        break;
      case 'info':
        console.info(consoleMessage, metadata);
        break;
      default:
        console.log(consoleMessage, metadata);
    }
  } catch (error) {
    console.error('Failed to write log entry:', error.message);
  }
}

/**
 * Log info message
 */
async function logInfo(message, metadata) {
  await writeLogEntry('info', message, metadata);
}

/**
 * Log warning message
 */
async function logWarning(message, metadata) {
  await writeLogEntry('warn', message, metadata);
}

/**
 * Log error message
 */
async function logError(message, metadata) {
  await writeLogEntry('error', message, metadata);
}

/**
 * Log debug message
 */
async function logDebug(message, metadata) {
  if (process.env.NODE_ENV === 'development') {
    await writeLogEntry('debug', message, metadata);
  }
}

/**
 * Read recent log entries
 */
async function getRecentLogs(lineCount = 100) {
  try {
    const logContent = await fs.readFile(logFile, 'utf-8');
    const lines = logContent.trim().split('\n');
    const recentLines = lines.slice(-lineCount);
    
    return recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (error) {
    return [];
  }
}

/**
 * Clear old logs
 */
async function clearOldLogs(daysToKeep = 30) {
  try {
    const files = await fs.readdir(logDirectory);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(logDirectory, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.remove(filePath);
        console.log(`Removed old log file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error clearing old logs:', error.message);
  }
}

// Initialize on load
ensureLogDirectory();

module.exports = {
  logInfo,
  logWarning,
  logError,
  logDebug,
  getRecentLogs,
  clearOldLogs
};
