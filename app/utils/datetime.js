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

/**
 * Parse a timestamp string (e.g. 'YYYY-MM-DD HH:MM:SS' or ISO) assuming it's in the
 * configured timezone and return a Date object in UTC representing that moment.
 * If the input is already a Date or an ISO string that the JS Date parser understands
 * it will be returned as-is.
 * @param {string|Date|number} timestamp
 * @returns {Date}
 */
function parseTimestampToDate(timestamp) {
  const timezone = process.env.TIMEZONE || 'UTC';

  if (!timestamp) return new Date(NaN);
  if (timestamp instanceof Date) return timestamp;
  // If it's a number (epoch ms), return Date
  if (typeof timestamp === 'number') return new Date(timestamp);

  // Try native parser first (ISO strings, etc.)
  const native = new Date(timestamp);
  if (!isNaN(native.getTime())) return native;

  // Support common 'YYYY-MM-DD HH:MM:SS' format
  const m = String(timestamp).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?$/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    // Create a UTC date for the same numeric components
    const utcDate = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss || '0')));

    // Determine timezone offset for the target timezone at this moment
    const offsetStr = getTimezoneOffset(timezone); // like +07:00
    const sign = offsetStr[0] === '-' ? -1 : 1;
    const [oh, om] = offsetStr.slice(1).split(':').map(n => Number(n) || 0);
    const offsetMinutes = sign * (oh * 60 + om);

    // Convert the local time in target timezone to UTC epoch: epoch = utcDate - offsetMinutes
    const epoch = utcDate.getTime() - offsetMinutes * 60 * 1000;
    return new Date(epoch);
  }

  // Fallback to native parser result (may be invalid)
  return native;
}

/**
 * Format an input timestamp (Date/ISO/string) to DB-friendly 'YYYY-MM-DD HH:MM:SS'
 * in the configured timezone.
 * @param {string|Date|number} timestamp
 * @returns {string}
 */
function formatForDb(timestamp) {
  try {
    const timezone = process.env.TIMEZONE || 'UTC';
    const date = timestamp instanceof Date ? timestamp : parseTimestampToDate(timestamp);
    // Use formatter with timezone to get components
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

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const get = t => parts.find(p => p.type === t)?.value || '00';

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (err) {
    return getCurrentTimestamp();
  }
}

module.exports = {
  getCurrentTimestamp,
  formatTimestamp,
  getTimezoneInfo,
  getTimezoneOffset,
  parseTimestampToDate,
  formatForDb
};





