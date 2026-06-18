'use strict';
// HTTP trigger for the scheduled Render Cron Job. Render cron jobs cannot mount
// the web service's persistent disk, so instead of opening the DB directly this
// just calls POST /api/backup on the running web service, authenticated by the
// shared BACKUP_TOKEN. Dependency-free (uses Node 18+ global fetch).
const url = process.env.BACKUP_URL;        // e.g. https://vozong-portfolio.onrender.com/api/backup
const token = process.env.BACKUP_TOKEN;

// Optional failure alert. If ALERT_WEBHOOK is set (a Slack or Discord incoming
// webhook URL), a message is posted when a backup fails so a silent cron error
// doesn't go unnoticed. Best-effort — never masks the original failure.
const webhook = process.env.ALERT_WEBHOOK;

async function notifyFailure(message) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // include both keys so one body works for Slack ("text") and Discord ("content")
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch (e) {
    console.error('[trigger-backup] alert webhook failed:', e?.message || e);
  }
}

async function main() {
  if (!url || !token) {
    console.error('[trigger-backup] BACKUP_URL and BACKUP_TOKEN must be set');
    process.exit(1);
  }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'X-Backup-Token': token } });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
    console.log('[trigger-backup] ok:', body);
    process.exit(0);
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[trigger-backup] failed:', msg);
    await notifyFailure(`⚠️ Portfolio DB backup failed: ${msg}`);
    process.exit(1);
  }
}

main();
