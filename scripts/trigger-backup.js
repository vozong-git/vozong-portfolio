'use strict';
// HTTP trigger for the scheduled Render Cron Job. Render cron jobs cannot mount
// the web service's persistent disk, so instead of opening the DB directly this
// just calls POST /api/backup on the running web service, authenticated by the
// shared BACKUP_TOKEN. Dependency-free (uses Node 18+ global fetch).
const url = process.env.BACKUP_URL;        // e.g. https://vozong-portfolio.onrender.com/api/backup
const token = process.env.BACKUP_TOKEN;

if (!url || !token) {
  console.error('[trigger-backup] BACKUP_URL and BACKUP_TOKEN must be set');
  process.exit(1);
}

fetch(url, { method: 'POST', headers: { 'X-Backup-Token': token } })
  .then(async (res) => {
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
    console.log('[trigger-backup] ok:', body);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[trigger-backup] failed:', e?.message || e);
    process.exit(1);
  });
