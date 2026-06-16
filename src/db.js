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
  category        TEXT    NOT NULL DEFAULT 'studio'  -- studio|master|live|playback|custom
                    CHECK (category IN ('studio','master','live','playback','custom')),
  custom_category TEXT,                              -- label when category = 'custom'
  tags            TEXT,                              -- comma list, e.g. "MIXING,MASTERING"
  technical_specs TEXT,                              -- Hardware/Software deployment
  description     TEXT,                              -- technical notes
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

CREATE TABLE IF NOT EXISTS timeline (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT    NOT NULL,                       -- e.g. "FOH Engineer"
  venue      TEXT,                                   -- e.g. "Red Rocks Amphitheatre"
  period     TEXT,                                   -- e.g. "Oct 2023 - Present"
  is_current INTEGER NOT NULL DEFAULT 0,
  kind       TEXT    NOT NULL DEFAULT 'live'         -- live|playback
               CHECK (kind IN ('live','playback')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

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
`;

function init() {
  open().exec(SCHEMA);
  // migration: older DBs created before timeline.kind existed
  const cols = db.prepare('PRAGMA table_info(timeline)').all();
  if (!cols.some((c) => c.name === 'kind')) {
    db.exec("ALTER TABLE timeline ADD COLUMN kind TEXT NOT NULL DEFAULT 'live'");
  }
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

module.exports = {
  open, init,
  get db() { return open(); },
  getAdminState, saveAdminIdentity, setFolderId,
  getContact, saveContact,
  encrypt, decrypt,
};
