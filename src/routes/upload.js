'use strict';
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const db = require('../db');
const drive = require('../drive');
const { requireAdmin } = require('../auth');

const router = express.Router();

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const AUDIO_MIMES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/aiff', 'audio/x-aiff',
  'audio/mpeg', 'audio/mp3',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 12 },
  fileFilter: (_req, file, cb) => {
    const m = (file.mimetype || '').toLowerCase();
    if (IMAGE_MIMES.has(m) || AUDIO_MIMES.has(m)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

function kindFor(mime) {
  return IMAGE_MIMES.has((mime || '').toLowerCase()) ? 'image' : 'audio';
}

function safeName(original) {
  const ext = path.extname(original || '');
  const base = path.basename(original || 'file', ext).replace(/[^\w.\-가-힣 ]+/g, '_').slice(0, 80);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base || 'file'}_${stamp}${ext}`;
}

// POST /api/upload   (admin)
// multipart/form-data:  project_id (required), files[] (1..12), cover (optional file_name to flag)
router.post('/', requireAdmin, (req, res) => {
  upload.array('files', 12)(req, res, async (err) => {
    if (err) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(code).json({ error: 'upload_failed', message: err.message });
    }
    const projectId = parseInt(req.body.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });
    const project = db.db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'project_not_found' });
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'no_files' });

    // audio uploads only allowed if an audio folder is configured
    if (!config.drive.audioFolder && req.files.some(f => kindFor(f.mimetype) === 'audio')) {
      return res.status(400).json({ error: 'audio_disabled', message: 'DRIVE_AUDIO_FOLDER not set' });
    }

    const created = [];
    try {
      for (const file of req.files) {
        const kind = kindFor(file.mimetype);
        const name = safeName(file.originalname);
        const driveFile = await drive.uploadBuffer({
          buffer: file.buffer,
          name,
          mimeType: file.mimetype,
          kind,
        });
        const isCover = kind === 'image' &&
          (req.body.cover ? file.originalname === req.body.cover : created.every(c => c.kind !== 'image'));
        const info = db.db.prepare(`
          INSERT INTO assets (project_id, drive_file_id, file_name, file_type, kind, is_cover)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(projectId, driveFile.id, name, file.mimetype, kind, isCover ? 1 : 0);
        created.push({ id: info.lastInsertRowid, kind, name, url: `/api/assets/${info.lastInsertRowid}/raw` });
      }
    } catch (e) {
      if (e.code === 'DRIVE_NOT_LINKED') {
        return res.status(409).json({ error: 'drive_not_linked', message: 'Sign in with Google to link Drive.' });
      }
      console.error('[upload]', e?.message || e);
      return res.status(502).json({ error: 'drive_upload_failed', message: e?.message });
    }
    res.status(201).json({ uploaded: created });
  });
});

module.exports = router;
