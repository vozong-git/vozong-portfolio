'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const config = require('./config');

let db;

function open() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  client_name     TEXT,
  completion_date TEXT,                              -- ISO date (YYYY-MM-DD)
  category        TEXT    NOT NULL DEFAULT 'studio',  -- validated in routes/projects.js (CATEGORIES)
  custom_category TEXT,                              -- label when category = 'custom'
  tags            TEXT,                              -- comma list, e.g. "MIXING,MASTERING"
  technical_specs TEXT,                              -- Hardware/Software deployment
  description     TEXT,                              -- technical notes
  youtube_url     TEXT,                              -- optional YouTube video link
  status          TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drive_file_id TEXT    NOT NULL,
  file_name     TEXT    NOT NULL,
  file_type     TEXT,                                -- mime type
  kind          TEXT    NOT NULL DEFAULT 'image'     -- image|audio
                  CHECK (kind IN ('image','audio')),
  is_cover      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);

-- single-row table holding public contact details (editable in admin)
CREATE TABLE IF NOT EXISTS contact (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  email      TEXT,
  phone      TEXT,
  location   TEXT,
  headline   TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- single-row table holding the admin's Drive credentials + cached folder ids
CREATE TABLE IF NOT EXISTS admin_state (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  email            TEXT,
  name             TEXT,
  picture          TEXT,
  refresh_token    TEXT,                             -- AES-256-GCM encrypted
  image_folder_id  TEXT,
  audio_folder_id  TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- cache of "artist title" → resolved YouTube video id (empty = no match),
-- so the YouTube Data API is called at most once per query (quota-friendly).
CREATE TABLE IF NOT EXISTS yt_cache (
  query       TEXT PRIMARY KEY,
  video_id    TEXT,                                  -- '' means resolved-but-no-match
  resolved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function init() {
  open().exec(SCHEMA);
  // migration: projects.youtube_url added later
  const cols = db.prepare('PRAGMA table_info(projects)').all();
  if (!cols.some((c) => c.name === 'youtube_url')) {
    db.exec('ALTER TABLE projects ADD COLUMN youtube_url TEXT');
  }

  // migration: drop the category CHECK constraint. SQLite can't ALTER a CHECK in
  // place, so adding/renaming work categories used to require a schema change.
  // Rebuild the table without it (column names are listed explicitly so the copy
  // is safe regardless of column order) and let routes/projects.js CATEGORIES be
  // the single source of truth for valid categories.
  const t = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
  if (t && /CHECK\s*\(\s*category/i.test(t.sql)) {
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE projects_new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          title           TEXT    NOT NULL,
          client_name     TEXT,
          completion_date TEXT,
          category        TEXT    NOT NULL DEFAULT 'studio',
          custom_category TEXT,
          tags            TEXT,
          technical_specs TEXT,
          description     TEXT,
          youtube_url     TEXT,
          status          TEXT    NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','published')),
          sort_order      INTEGER NOT NULL DEFAULT 0,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(`
        INSERT INTO projects_new
          (id, title, client_name, completion_date, category, custom_category,
           tags, technical_specs, description, youtube_url, status, sort_order, created_at, updated_at)
        SELECT
           id, title, client_name, completion_date, category, custom_category,
           tags, technical_specs, description, youtube_url, status, sort_order, created_at, updated_at
        FROM projects;
      `);
      db.exec('DROP TABLE projects');
      db.exec('ALTER TABLE projects_new RENAME TO projects');
    });
    // FK toggling must happen outside the transaction (assets references projects)
    db.pragma('foreign_keys = OFF');
    try {
      rebuild();
      const issues = db.pragma('foreign_key_check');
      if (issues.length) console.error('[migration] FK issues after category rebuild:', issues);
      else console.log('[migration] dropped projects.category CHECK constraint');
    } catch (e) {
      console.error('[migration] category CHECK rebuild failed (kept old schema):', e?.message || e);
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  // migration: the short-lived 'livetune' category was merged back into
  // 'playback' (now labelled "Playback & Live Tune"). Idempotent — no-op once
  // no rows remain.
  db.prepare("UPDATE projects SET category = 'playback' WHERE category = 'livetune'").run();

  return db;
}

/* ── token encryption (Drive refresh token at rest) ── */
function encKey() {
  // derive a stable 32-byte key from config secret
  return crypto.createHash('sha256').update(String(config.tokenEncKey)).digest();
}
function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decrypt(blob) {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/* ── admin_state helpers ── */
function getAdminState() {
  open();
  const row = db.prepare('SELECT * FROM admin_state WHERE id = 1').get();
  if (!row) return null;
  return { ...row, refresh_token: decrypt(row.refresh_token) };
}

function saveAdminIdentity({ email, name, picture, refreshToken }) {
  open();
  const existing = db.prepare('SELECT id FROM admin_state WHERE id = 1').get();
  const encRt = refreshToken ? encrypt(refreshToken) : undefined;
  if (existing) {
    // keep prior refresh_token if Google didn't return a new one this time
    db.prepare(`
      UPDATE admin_state
         SET email = ?, name = ?, picture = ?,
             refresh_token = COALESCE(?, refresh_token),
             updated_at = datetime('now')
       WHERE id = 1
    `).run(email, name || null, picture || null, encRt ?? null);
  } else {
    db.prepare(`
      INSERT INTO admin_state (id, email, name, picture, refresh_token)
      VALUES (1, ?, ?, ?, ?)
    `).run(email, name || null, picture || null, encRt ?? null);
  }
}

function setFolderId(kind, folderId) {
  open();
  const col = kind === 'audio' ? 'audio_folder_id' : 'image_folder_id';
  db.prepare(`UPDATE admin_state SET ${col} = ?, updated_at = datetime('now') WHERE id = 1`).run(folderId);
}

/* ── contact (single row) ── */
function getContact() {
  open();
  return db.prepare('SELECT email, phone, location, headline, updated_at FROM contact WHERE id = 1').get() || null;
}

function saveContact({ email, phone, location, headline }) {
  open();
  const existing = db.prepare('SELECT id FROM contact WHERE id = 1').get();
  const vals = [email ?? null, phone ?? null, location ?? null, headline ?? null];
  if (existing) {
    db.prepare(`UPDATE contact SET email = ?, phone = ?, location = ?, headline = ?, updated_at = datetime('now') WHERE id = 1`).run(...vals);
  } else {
    db.prepare(`INSERT INTO contact (id, email, phone, location, headline) VALUES (1, ?, ?, ?, ?)`).run(...vals);
  }
}

/* ── YouTube resolve cache ── */
// Positive matches are cached forever. Negative results (video_id = '' "no
// match") expire after this many days so a video uploaded/renamed later can be
// re-resolved instead of being stuck as "not found".
const YT_NEG_TTL_DAYS = 7;

function getYtCache(query) {
  open();
  const row = db.prepare(
    `SELECT video_id, resolved_at, (julianday('now') - julianday(resolved_at)) AS age_days
       FROM yt_cache WHERE query = ?`
  ).get(query);
  if (!row) return null;
  if (!row.video_id && row.age_days > YT_NEG_TTL_DAYS) return null; // stale negative → re-resolve
  return row;
}

function putYtCache(query, videoId) {
  open();
  db.prepare(`
    INSERT INTO yt_cache (query, video_id) VALUES (?, ?)
    ON CONFLICT(query) DO UPDATE SET video_id = excluded.video_id, resolved_at = datetime('now')
  `).run(query, videoId || '');
}

module.exports = {
  open, init,
  get db() { return open(); },
  getAdminState, saveAdminIdentity, setFolderId,
  getContact, saveContact,
  getYtCache, putYtCache,
  encrypt, decrypt,
};
