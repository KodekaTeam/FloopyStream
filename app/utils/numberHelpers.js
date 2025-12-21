/**
 * Number utility functions for FloopyStream
 */

/**
 * Safely parse numeric strings that might contain commas, periods, or spaces as thousand separators
 * @param {string|number} str - The string or number to parse
 * @returns {number} - The parsed integer, or 0 if parsing fails
 */
function parseNumericString(str) {
  if (typeof str !== 'string') return parseInt(str) || 0;
  // Remove commas, periods, and spaces that are used as thousand separators
  const cleaned = str.replace(/[,.\s]/g, '');
  return parseInt(cleaned) || 0;
}

module.exports = {
  parseNumericString
};