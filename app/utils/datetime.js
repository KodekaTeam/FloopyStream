/**
 * DateTime utility with timezone support
 */

/**
 * Get current timestamp in configured timezone
 * @returns {string} ISO timestamp string
 */
function getCurrentTimestamp() {
  const timezone = process.env.TIMEZONE || 'UTC';
  
  try {
    // Use Intl API for timezone conversion
    const now = new Date();
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const parts = formatter.formatToParts(now);
    
    const getValue = (type) => parts.find(p => p.type === type)?.value || '00';
    
    const year = getValue('year');
    const month = getValue('month');
    const day = getValue('day');
    const hour = getValue('hour');
    const minute = getValue('minute');
    const second = getValue('second');
    
    // Return in SQLite-compatible format: YYYY-MM-DD HH:MM:SS
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    console.error('Timezone conversion error:', error.message);
    // Fallback to UTC
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }
}

/**
 * Format timestamp for display with timezone
 * @param {string|Date} timestamp - Timestamp to format
 * @param {string} format - Format style: 'full', 'date', 'time', 'datetime'
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp, format = 'datetime') {
  const timezone = process.env.TIMEZONE || 'UTC';
  
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    const options = {
      timeZone: timezone,
      hour12: false
    };
    
    switch (format) {
      case 'full':
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
      case 'date':
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
      case 'datetime':
      default:
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
    }
    
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  } catch (error) {
    console.error('Format timestamp error:', error.message);
    return timestamp?.toString() || 'N/A';
  }
}

/**
 * Get timezone info
 * @returns {Object} Timezone information
 */
function getTimezoneInfo() {
  const timezone = process.env.TIMEZONE || 'UTC';
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(now);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || timezone;
    
    return {
      timezone,
      displayName: tzName,
      offset: getTimezoneOffset(timezone)
    };
  } catch (error) {
    return {
      timezone: 'UTC',
      displayName: 'UTC',
      offset: '+00:00'
    };
  }
}

/**
 * Get timezone offset
 * @param {string} timezone - Timezone name
 * @returns {string} Offset string like +07:00
 */
function getTimezoneOffset(timezone) {
  try {
    const now = new Date();
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offset = (tzDate - utcDate) / (1000 * 60 * 60);
    
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset);
    const minutes = Math.round((absOffset - hours) * 60);
    
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch (error) {
    return '+00:00';
  }
}

module.exports = {
  getCurrentTimestamp,
  formatTimestamp,
  getTimezoneInfo,
  getTimezoneOffset
};
