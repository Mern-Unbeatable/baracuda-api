import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { UPLOADS_DIR } from '../utils/upload.js';

const CACHE_DIR = path.join(UPLOADS_DIR, '.thumb-cache');
const MAX_WIDTH = 1600;
const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.tif',
  '.tiff',
]);

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function safeUploadPath(relativePath) {
  const normalized = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^[/\\]+/, '');
  const absolute = path.resolve(UPLOADS_DIR, normalized);
  if (!absolute.startsWith(UPLOADS_DIR)) return null;
  if (absolute.startsWith(CACHE_DIR)) return null;
  return absolute;
}

function sendCachedFile(res, cachePath, next) {
  res.type('image/jpeg');
  // Callback form — sendFile errors are async and bypass try/catch.
  return res.sendFile(cachePath, (err) => {
    if (!err) return;
    if (res.headersSent) return;
    console.warn('[uploadThumb] cache miss after resize, serving original:', err.message);
    return next();
  });
}

/**
 * Serves resized image variants for card grids.
 * Usage: GET /uploads/photo.jpg?w=480
 * Falls through to express.static when ?w is absent or file is not an image.
 */
export async function uploadThumbMiddleware(req, res, next) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const widthRaw = Number.parseInt(String(req.query.w || ''), 10);
    if (!Number.isFinite(widthRaw) || widthRaw <= 0) return next();

    const width = Math.min(Math.max(widthRaw, 32), MAX_WIDTH);
    const relativePath = decodeURIComponent(String(req.path || '').replace(/^\/+/, ''));
    if (!relativePath || relativePath.includes('\0')) return next();

    const ext = path.extname(relativePath).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return next();

    const sourcePath = safeUploadPath(relativePath);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      // Missing original — quiet 404 (avoid sendFile NotFoundError spam).
      return res.status(404).end();
    }

    ensureCacheDir();
    const cacheName = `w${width}-${relativePath.replace(/[/\\]/g, '__')}`;
    const cachePath = path.join(CACHE_DIR, cacheName);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Vary', 'Accept');

    if (fs.existsSync(cachePath)) {
      return sendCachedFile(res, cachePath, next);
    }

    await sharp(sourcePath)
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(cachePath);

    if (!fs.existsSync(cachePath)) return next();
    return sendCachedFile(res, cachePath, next);
  } catch (err) {
    console.warn('[uploadThumb] resize failed, falling back to original:', err?.message);
    return next();
  }
}
