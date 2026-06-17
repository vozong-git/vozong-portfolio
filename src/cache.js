'use strict';
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Thumbnails are tiny, immutable-per-asset JPEGs. Caching their bytes on the
// (persistent) disk next to the DB means a card render no longer costs one
// Drive API round-trip each time — only the first miss does.
const CACHE_DIR = path.join(path.dirname(config.dbPath), 'cache', 'thumbs');

function thumbPath(assetId, size) {
  return path.join(CACHE_DIR, `${assetId}-${size}.jpg`);
}

/** Read a cached thumbnail buffer, or null on miss. */
function getThumb(assetId, size) {
  try {
    return fs.readFileSync(thumbPath(assetId, size));
  } catch {
    return null;
  }
}

/** Persist a thumbnail buffer (atomic rename). Best-effort — never throws. */
function putThumb(assetId, size, buf) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const dest = thumbPath(assetId, size);
    const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, dest);
  } catch (e) {
    console.error('[cache put]', e?.message || e);
  }
}

/** Drop every cached size for an asset (call when its Drive file is deleted). */
function delThumb(assetId) {
  try {
    const prefix = `${assetId}-`;
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (f.startsWith(prefix)) fs.unlinkSync(path.join(CACHE_DIR, f));
    }
  } catch { /* dir may not exist yet — nothing to clear */ }
}

module.exports = { getThumb, putThumb, delThumb, CACHE_DIR };
