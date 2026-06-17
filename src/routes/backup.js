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

// POST /api/backup (admin) — create a backup now
router.post('/', requireAdmin, async (req, res) => {
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
