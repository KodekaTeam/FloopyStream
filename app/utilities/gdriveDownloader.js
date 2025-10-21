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
  // ensure directory
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  let retryCount = 0;
  const maxRetries = 3;
  let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  let response;

  while (retryCount < maxRetries) {
    try {
      const head = await axios.head(downloadUrl, { timeout: 30000, maxRedirects: 10, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const contentType = (head.headers['content-type'] || '').toLowerCase();

      if (contentType.includes('text/html')) {
        if (retryCount === 0) {
          downloadUrl = `https://drive.googleusercontent.com/uc?export=download&id=${fileId}&confirm=t`;
        } else if (retryCount === 1) {
          downloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`;
        }
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error('File appears to be private or requires authentication. Please make it publicly accessible or use an authenticated Drive integration.');
        }
        continue;
      }

      response = await axios({ method: 'GET', url: downloadUrl, responseType: 'stream', timeout: 600000, maxRedirects: 10, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' } });
      break;
    } catch (err) {
      retryCount++;
      if (retryCount >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, 2000 * retryCount));
    }
  }

  if (!response || response.status !== 200) {
    throw new Error(`HTTP ${response ? response.status : 'ERR'}: Failed to download file`);
  }

  const contentType = (response.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error('Received HTML page instead of file. The file might be private or require additional permissions.');
  }

  const writer = fs.createWriteStream(destinationPath);
  let downloaded = 0;
  const total = parseInt(response.headers['content-length'] || '0');

  response.data.on('data', (chunk) => {
    downloaded += chunk.length;
    if (total > 0 && progressCallback) {
      const progress = Math.round((downloaded / total) * 100);
      progressCallback(Math.min(progress, 100));
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      try {
        if (!fs.existsSync(destinationPath)) return reject(new Error('Downloaded file not found'));
        const stats = fs.statSync(destinationPath);
        const size = stats.size;
        if (size === 0) { fs.unlinkSync(destinationPath); return reject(new Error('Downloaded file is empty. The file might be private or the link is invalid.')); }
        if (size < 1024) { fs.unlinkSync(destinationPath); return reject(new Error('Downloaded file is too small to be a valid video.')); }

        const fd = fs.openSync(destinationPath, 'r');
        const header = Buffer.alloc(512);
        fs.readSync(fd, header, 0, 512, 0);
        fs.closeSync(fd);
        const headerStr = header.toString('utf8', 0, 100).toLowerCase();
        if (headerStr.includes('<!doctype html') || headerStr.includes('<html') || headerStr.includes('<head>')) {
          fs.unlinkSync(destinationPath);
          return reject(new Error('Downloaded content is an HTML page, not a video file. The file might be private or require authentication.'));
        }

        const validHeaders = [Buffer.from([0x00,0x00,0x00,0x18,0x66,0x74,0x79,0x70]), Buffer.from([0x1A,0x45,0xDF,0xA3])];
        let ok = false;
        for (const vh of validHeaders) {
          if (header.slice(0, vh.length).equals(vh)) { ok = true; break; }
        }
        if (!ok && !header.includes(Buffer.from('ftyp'))) {
          fs.unlinkSync(destinationPath);
          return reject(new Error('Downloaded file does not appear to be a valid video format.'));
        }

        resolve({ path: destinationPath, size });
      } catch (err) {
        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
        reject(err);
      }
    });

    writer.on('error', (err) => {
      if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      reject(err);
    });

    response.data.on('error', (err) => {
      if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      reject(err);
    });
  });
}

module.exports = { extractFileId, downloadFile };
