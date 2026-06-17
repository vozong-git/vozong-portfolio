'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const db = require('../db');
const drive = require('../drive');
const { requireAdmin } = require('../auth');

const router = express.Router();

/** Snapshot the SQLite DB and upload it to Drive's portfolio_backup folder.
 *  Shared by the admin route and the cron script. */
async function runBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `portfolio-${stamp}.db`;
  const tmpPath = path.join(os.tmpdir(), name);
  try {
    // better-sqlite3 .backup() is a safe online snapshot (WAL-aware)
    await db.db.backup(tmpPath);
    const file = await drive.uploadBackup(tmpPath, name);
    return { name, file };
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}

// Allow either an authenticated admin OR a request bearing the shared
// BACKUP_TOKEN header — the latter lets a scheduled Render cron trigger
// backups over HTTP (cron jobs can't share the web service's disk).
function requireAdminOrToken(req, res, next) {
  const token = process.env.BACKUP_TOKEN;
  if (token && req.get('X-Backup-Token') === token) return next();
  return requireAdmin(req, res, next);
}

// POST /api/backup (admin or X-Backup-Token) — create a backup now
router.post('/', requireAdminOrToken, async (req, res) => {
  try {
    const { name, file } = await runBackup();
    res.json({ ok: true, name, fileId: file.id });
  } catch (e) {
    if (e.code === 'DRIVE_NOT_LINKED') return res.status(409).json({ error: 'drive_not_linked' });
    console.error('[backup]', e?.message || e);
    res.status(500).json({ error: 'backup_failed' });
  }
});

module.exports = router;
module.exports.runBackup = runBackup;
