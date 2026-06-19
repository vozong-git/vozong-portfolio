'use strict';
const express = require('express');
const db = require('../db');
const drive = require('../drive');
const cache = require('../cache');
const { requireAdmin } = require('../auth');

const router = express.Router();

// GET /api/assets/:id/raw  (public) — stream the Drive file through the server,
// so Drive files stay private and the public URL is stable & cacheable.
router.get('/:id/raw', async (req, res) => {
  const asset = db.db.prepare(`
    SELECT a.*, p.status AS project_status
      FROM assets a JOIN projects p ON p.id = a.project_id
     WHERE a.id = ?
  `).get(req.params.id);
  if (!asset) return res.status(404).end();

  // hide assets of unpublished projects from non-admins
  const isAdmin = req.user && req.user.role === 'admin';
  if (asset.project_status !== 'published' && !isAdmin) return res.status(404).end();

  // thumbnail (images only): served from a disk cache; on miss we fetch the
  // Drive thumbnail once and store it. Per-asset thumbnails never change, so
  // they can be cached aggressively. Falls back to the full image on failure.
  const thumb = parseInt(req.query.thumb, 10);
  if (thumb && asset.kind === 'image' && [120, 160, 200, 320, 400, 640, 800].includes(thumb)) {
    const cached = cache.getThumb(asset.id, thumb);
    if (cached) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Thumb-Cache', 'HIT');
      return res.end(cached);
    }
    try {
      const t = await drive.getThumbnail(asset.drive_file_id, thumb);
      if (t) {
        cache.putThumb(asset.id, thumb, t.buffer);
        res.setHeader('Content-Type', t.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Thumb-Cache', 'MISS');
        return res.end(t.buffer);
      }
    } catch (_) { /* fall through to full image */ }
  }

  try {
    const { stream, meta } = await drive.getFileStream(asset.drive_file_id);
    res.setHeader('Content-Type', meta.mimeType || asset.file_type || 'application/octet-stream');
    if (meta.size) res.setHeader('Content-Length', meta.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.file_name)}"`);
    stream.on('error', () => { if (!res.headersSent) res.status(502).end(); });
    stream.pipe(res);
  } catch (e) {
    if (e.code === 'DRIVE_NOT_LINKED') return res.status(409).end();
    console.error('[asset stream]', e?.message || e);
    res.status(502).end();
  }
});

// PATCH /api/assets/:id/cover  (admin) — set this image as the project cover
router.patch('/:id/cover', requireAdmin, (req, res) => {
  const asset = db.db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'not_found' });
  if (asset.kind !== 'image') return res.status(400).json({ error: 'not_an_image' });
  const tx = db.db.transaction(() => {
    db.db.prepare('UPDATE assets SET is_cover = 0 WHERE project_id = ?').run(asset.project_id);
    db.db.prepare('UPDATE assets SET is_cover = 1 WHERE id = ?').run(asset.id);
  });
  tx();
  res.json({ ok: true });
});

// DELETE /api/assets/:id  (admin) — remove asset row + Drive file
router.delete('/:id', requireAdmin, async (req, res) => {
  const asset = db.db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'not_found' });
  await drive.deleteFile(asset.drive_file_id);
  db.db.prepare('DELETE FROM assets WHERE id = ?').run(asset.id);
  cache.delThumb(asset.id);
  res.json({ ok: true });
});

module.exports = router;
