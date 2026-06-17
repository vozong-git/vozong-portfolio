'use strict';
// Standalone backup runner for a scheduled job (e.g. Render Cron Job:
// `node scripts/backup.js`). Requires the same env as the server, including a
// linked Drive (refresh token in the DB).
const { runBackup } = require('../src/routes/backup');

runBackup()
  .then(({ name, file }) => {
    console.log(`[backup] uploaded ${name} (id=${file.id})`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[backup] failed:', e?.message || e);
    process.exit(1);
  });
