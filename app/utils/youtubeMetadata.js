function removeInvalidSurrogates(input) {
  if (typeof input !== 'string') return '';

  let output = '';
  for (let i = 0; i < input.length; i++) {
    const codeUnit = input.charCodeAt(i);

    // High surrogate
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = input.charCodeAt(i + 1);
      // Valid surrogate pair
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        output += input[i] + input[i + 1];
        i++;
        continue;
      }
      // Unpaired high surrogate -> drop
      continue;
    }

    // Unpaired low surrogate -> drop
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      continue;
    }

    output += input[i];
  }

  return output;
}

function sliceByCodePoints(str, maxCodePoints) {
  if (!str || maxCodePoints <= 0) return '';
  const codePoints = Array.from(str);
  if (codePoints.length <= maxCodePoints) return str;
  return codePoints.slice(0, maxCodePoints).join('');
}

/**
 * Sanitize a YouTube broadcast title.
 *
 * Common YouTube failure cases:
 * - Empty/whitespace
 * - Contains control characters (incl. newlines)
 * - Too long (YouTube Live Broadcast title limit is effectively ~100 chars)
 * - Unpaired surrogates
 */
function sanitizeYouTubeTitle(title, options = {}) {
  const fallback = (options.fallback ?? 'FloopyStream Broadcast');
  const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 100;

  let value = '';
  if (title === null || title === undefined) {
    value = '';
  } else {
    value = String(title);
  }

  // Normalize to reduce weird unicode edge-cases
  if (typeof value.normalize === 'function') {
    value = value.normalize('NFC');
  }

  value = removeInvalidSurrogates(value);

  // Drop ASCII control chars (includes \n, \r, \t, etc.)
  value = value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // Collapse whitespace
  value = value.replace(/\s+/g, ' ').trim();

  if (!value) {
    value = String(fallback).trim() || 'FloopyStream Broadcast';
  }

  value = sliceByCodePoints(value, maxLength);

  // Final trim after slicing
  value = value.trim();

  if (!value) {
    value = 'FloopyStream Broadcast';
  }

  return value;
}

module.exports = {
  sanitizeYouTubeTitle,
};
