const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

function extractFileId(driveUrl) {
  if (!driveUrl) throw new Error('No Google Drive URL provided');

  let match = driveUrl.match(/\/file\/d\/([^\/]+)/);
  if (match) return match[1];

  match = driveUrl.match(/\?id=([^&]+)/);
  if (match) return match[1];

  match = driveUrl.match(/\/d\/([^\/]+)/);
  if (match) return match[1];

  if (/^[a-zA-Z0-9_-]{25,}$/.test(driveUrl.trim())) {
    return driveUrl.trim();
  }

  throw new Error('Invalid Google Drive URL format');
}

async function downloadFile(fileId, destinationPath, progressCallback = null) {
  try {
    // ensure directory exists
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempPath = path.join(path.dirname(destinationPath), tempFilename);

  const candidates = [
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
    `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.googleusercontent.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/uc?export=download&authuser=0&id=${fileId}`
  ];

  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };

  let response = null;
  let lastHtmlSnippet = null;
  let retryCount = 0;
  const maxRetries = Math.max(3, candidates.length + 1);

  while (retryCount < maxRetries) {
    try {
      const candidateIndex = Math.min(retryCount, candidates.length - 1);
      let downloadUrl = candidates[candidateIndex];

      // HEAD request to check content-type quickly
      const headResp = await axios.head(downloadUrl, { timeout: 30000, maxRedirects: 10, headers: defaultHeaders });
      const ctype = (headResp.headers['content-type'] || '').toLowerCase();

      if (ctype.includes('text/html')) {
        // We got an HTML page — try to parse confirm token / link and cookies
        const pageResp = await axios.get(downloadUrl, { timeout: 30000, maxRedirects: 10, headers: Object.assign({ Accept: 'text/html' }, defaultHeaders), responseType: 'text' });
        const html = pageResp.data || '';
        lastHtmlSnippet = (html || '').slice(0, 2000).replace(/\s+/g, ' ');

        // collect cookies
        const setCookie = pageResp.headers && pageResp.headers['set-cookie'] ? pageResp.headers['set-cookie'] : [];
        const cookieHeader = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : (setCookie || '');

        // Try token in HTML
        let tokenMatch = html.match(/confirm=([0-9A-Za-z_-]{1,})/);
        if (!tokenMatch) tokenMatch = html.match(/name\s*=\s*"confirm"\s+value\s*=\s*"([0-9A-Za-z_-]{1,})"/i);

        // Try cookie-based token like download_warning_<id>=token
        let cookieToken = null;
        if (Array.isArray(setCookie)) {
          for (const c of setCookie) {
            const m = c.match(/^download_warning_[^=]+=([^;]+)/);
            if (m) { cookieToken = m[1]; break; }
          }
        }

        if (tokenMatch && tokenMatch[1]) {
          const token = tokenMatch[1];
          downloadUrl = `${candidates[0]}&confirm=${token}`;
          response = await axios({ method: 'GET', url: downloadUrl, responseType: 'stream', timeout: 600000, maxRedirects: 10, headers: Object.assign({ Cookie: cookieHeader }, defaultHeaders) });
        } else if (cookieToken) {
          downloadUrl = `${candidates[0]}&confirm=${cookieToken}`;
          response = await axios({ method: 'GET', url: downloadUrl, responseType: 'stream', timeout: 600000, maxRedirects: 10, headers: Object.assign({ Cookie: cookieHeader }, defaultHeaders) });
        } else {
          // Try to find direct download href in HTML
          const hrefMatch = html.match(/href=["']([^"']*uc\?export=download[^"']*)["']/i);
          if (hrefMatch && hrefMatch[1]) {
            let href = hrefMatch[1].replace(/&amp;/g, '&');
            if (href.startsWith('//')) href = 'https:' + href;
            else if (href.startsWith('/')) href = 'https://drive.google.com' + href;
            response = await axios({ method: 'GET', url: href, responseType: 'stream', timeout: 600000, maxRedirects: 10, headers: Object.assign({ Cookie: cookieHeader }, defaultHeaders) });
          } else {
            // No token or href found, try next candidate
            retryCount++;
            continue;
          }
        }
      } else {
        // Normal path: perform streaming GET
        response = await axios({ method: 'GET', url: downloadUrl, responseType: 'stream', timeout: 600000, maxRedirects: 10, headers: defaultHeaders });
      }

      // Check if response is HTML
      const responseContentType = (response.headers['content-type'] || '').toLowerCase();
      if (responseContentType.includes('text/html')) {
        console.log('Received HTML response, trying alternative download method...');
        retryCount++;
        continue;
      }

      // Success
      break;
    } catch (err) {
      retryCount++;
      if (retryCount >= maxRetries) {
        // Enrich error message when HTML was encountered earlier
        if (lastHtmlSnippet) {
          throw new Error(`Received HTML page from Google Drive while attempting to download. Snippet: ${lastHtmlSnippet}`);
        }
        throw err;
      }
      // small backoff
      await new Promise(r => setTimeout(r, 2000 * retryCount));
    }
  }

  if (!response || response.status !== 200) {
    throw new Error(`HTTP ${response ? response.status : 'ERR'}: Failed to download file`);
  }

  const total = parseInt(response.headers['content-length'] || '0');
  let downloaded = 0;

  const writer = fs.createWriteStream(tempPath);
  response.data.on('data', (chunk) => {
    downloaded += chunk.length;
    if (total > 0 && progressCallback) {
      const progress = Math.round((downloaded / total) * 100);
      progressCallback({ id: fileId, filename: 'Google Drive File', progress: Math.min(progress, 100) });
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      try {
        if (!fs.existsSync(tempPath)) return reject(new Error('Downloaded file not found'));
        const stats = fs.statSync(tempPath);
        const size = stats.size;
        if (size === 0) { fs.unlinkSync(tempPath); return reject(new Error('Downloaded file is empty. The file might be private or the link is invalid.')); }
        if (size < 1024) { fs.unlinkSync(tempPath); return reject(new Error('Downloaded file is too small to be a valid video.')); }

        // check first bytes for HTML
        const fd = fs.openSync(tempPath, 'r');
        const header = Buffer.alloc(512);
        fs.readSync(fd, header, 0, 512, 0);
        fs.closeSync(fd);
        const headerStr = header.toString('utf8', 0, 100).toLowerCase();
        if (headerStr.includes('<!doctype html') || headerStr.includes('<html') || headerStr.includes('<head>')) {
          fs.unlinkSync(tempPath);
          return reject(new Error('Downloaded content is an HTML page, not a video file. The file might be private or require authentication.'));
        }

        // basic video header checks
        const validHeaders = [
          Buffer.from([0x00,0x00,0x00,0x18,0x66,0x74,0x79,0x70]),
          Buffer.from([0x00,0x00,0x00,0x1C,0x66,0x74,0x79,0x70]),
          Buffer.from([0x00,0x00,0x00,0x20,0x66,0x74,0x79,0x70]),
          Buffer.from([0x1A,0x45,0xDF,0xA3]),
          Buffer.from([0x00,0x00,0x01,0xBA]),
          Buffer.from([0x00,0x00,0x01,0xB3]),
          Buffer.from([0x46,0x4C,0x56,0x01])
        ];

        let ok = false;
        for (const vh of validHeaders) {
          if (header.slice(0, vh.length).equals(vh)) { ok = true; break; }
        }
        if (!ok && !header.includes(Buffer.from('ftyp'))) {
          fs.unlinkSync(tempPath);
          return reject(new Error('Downloaded file does not appear to be a valid video format.'));
        }

        // Move temp file to final destination
        fs.renameSync(tempPath, destinationPath);

        resolve({ path: destinationPath, size });
      } catch (err) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        reject(err);
      }
    });

    writer.on('error', (err) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });

    response.data.on('error', (err) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });
  });
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('File is private or sharing is disabled. Please make sure the file is publicly accessible and try again.');
      } else if (error.response.status === 404) {
        throw new Error('File not found. Please check the Google Drive URL and ensure the file exists.');
      } else if (error.response.status === 429) {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      } else if (error.response.status >= 500) {
        throw new Error('Google Drive server error. Please try again later.');
      } else {
        throw new Error(`Download failed with HTTP ${error.response.status}. Please try again or check if the file is accessible.`);
      }
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Download timeout. The file might be too large or your connection is slow. Please try again.');
    } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      throw new Error('Connection was reset. Please check your internet connection and try again.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Download was interrupted. Please try again.');
    } else {
      throw new Error(`Download failed: ${error.message}. Please try again or check your internet connection.`);
    }
  }
}

module.exports = { extractFileId, downloadFile };
