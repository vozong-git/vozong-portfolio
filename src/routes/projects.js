'use strict';
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

const CATEGORIES = ['studio', 'live', 'playback', 'custom'];
const STATUSES = ['draft', 'published'];

function serialize(p) {
  if (!p) return null;
  const assets = db.db.prepare(
    'SELECT id, file_name, file_type, kind, is_cover FROM assets WHERE project_id = ? ORDER BY is_cover DESC, id ASC'
  ).all(p.id);
  const cover = assets.find(a => a.kind === 'image');
  return {
    id: p.id,
    title: p.title,
    client_name: p.client_name,
    completion_date: p.completion_date,
    category: p.category,
    custom_category: p.custom_category,
    tags: p.tags ? p.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    technical_specs: p.technical_specs,
    description: p.description,
    youtube_url: p.youtube_url,
    status: p.status,
    sort_order: p.sort_order,
    created_at: p.created_at,
    updated_at: p.updated_at,
    cover_url: cover ? `/api/assets/${cover.id}/raw` : null,
    assets: assets.map(a => ({
      id: a.id,
      file_name: a.file_name,
      file_type: a.file_type,
      kind: a.kind,
      is_cover: !!a.is_cover,
      url: `/api/assets/${a.id}/raw`,
    })),
  };
}

function validate(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('title')) {
    const t = (body.title || '').toString().trim();
    if (!t) errors.push('title is required');
    else if (t.length > 200) errors.push('title too long');
    out.title = t;
  }
  if (has('client_name')) out.client_name = (body.client_name ?? '').toString().trim() || null;
  if (has('completion_date')) {
    const d = (body.completion_date ?? '').toString().trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push('completion_date must be YYYY-MM-DD');
    out.completion_date = d || null;
  }
  if (!partial || has('category')) {
    const c = (body.category || 'studio').toString().trim().toLowerCase();
    if (!CATEGORIES.includes(c)) errors.push(`category must be one of ${CATEGORIES.join(', ')}`);
    out.category = c;
  }
  if (has('custom_category')) out.custom_category = (body.custom_category ?? '').toString().trim() || null;
  if (has('tags')) {
    const tags = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',');
    out.tags = tags.map(s => s.toString().trim().toUpperCase()).filter(Boolean).join(',') || null;
  }
  if (has('technical_specs')) out.technical_specs = (body.technical_specs ?? '').toString().trim() || null;
  if (has('description')) out.description = (body.description ?? '').toString().trim() || null;
  if (has('youtube_url')) out.youtube_url = (body.youtube_url ?? '').toString().trim() || null;
  if (has('status')) {
    const s = (body.status || 'draft').toString().trim().toLowerCase();
    if (!STATUSES.includes(s)) errors.push(`status must be one of ${STATUSES.join(', ')}`);
    out.status = s;
  }
  if (has('sort_order')) out.sort_order = parseInt(body.sort_order, 10) || 0;

  return { errors, value: out };
}

// GET /api/projects?status=&category=&q=
// Visitors only ever receive published projects; admins can request all.
router.get('/', (req, res) => {
  const isAdmin = req.user && req.user.email && req.user.role === 'admin';
  const where = [];
  const params = [];

  if (!isAdmin) {
    where.push('status = ?'); params.push('published');
  } else if (req.query.status && STATUSES.includes(req.query.status)) {
    where.push('status = ?'); params.push(req.query.status);
  }
  if (req.query.category && CATEGORIES.includes(req.query.category)) {
    where.push('category = ?'); params.push(req.query.category);
  }
  if (req.query.q) {
    where.push('(title LIKE ? OR client_name LIKE ? OR description LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  const sql = `SELECT * FROM projects
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY sort_order ASC, COALESCE(completion_date, created_at) DESC, id DESC`;
  const rows = db.db.prepare(sql).all(...params);
  res.json({ projects: rows.map(serialize) });
});

// GET /api/projects/tags  (admin) — distinct tags, most-recently-used first.
// Declared before /:id so "tags" isn't captured as an :id param.
router.get('/tags', requireAdmin, (req, res) => {
  const rows = db.db.prepare(
    "SELECT tags FROM projects WHERE tags IS NOT NULL AND tags != '' ORDER BY updated_at DESC, id DESC"
  ).all();
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    for (const t of r.tags.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)) {
      if (!seen.has(t)) { seen.add(t); out.push(t); }
    }
    if (out.length >= 24) break;
  }
  res.json({ tags: out.slice(0, 24) });
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const row = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const isAdmin = req.user && req.user.role === 'admin';
  if (row.status !== 'published' && !isAdmin) return res.status(404).json({ error: 'not_found' });
  res.json({ project: serialize(row) });
});

// POST /api/projects  (admin)
router.post('/', requireAdmin, (req, res) => {
  const { errors, value } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'validation', details: errors });

  const stmt = db.db.prepare(`
    INSERT INTO projects (title, client_name, completion_date, category, custom_category,
                          tags, technical_specs, description, youtube_url, status, sort_order)
    VALUES (@title, @client_name, @completion_date, @category, @custom_category,
            @tags, @technical_specs, @description, @youtube_url, @status, @sort_order)
  `);
  const info = stmt.run({
    title: value.title,
    client_name: value.client_name ?? null,
    completion_date: value.completion_date ?? null,
    category: value.category ?? 'studio',
    custom_category: value.custom_category ?? null,
    tags: value.tags ?? null,
    technical_specs: value.technical_specs ?? null,
    description: value.description ?? null,
    youtube_url: value.youtube_url ?? null,
    status: value.status ?? 'draft',
    sort_order: value.sort_order ?? 0,
  });
  const row = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ project: serialize(row) });
});

// PATCH /api/projects/:id  (admin)
router.patch('/:id', requireAdmin, (req, res) => {
  const existing = db.db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const { errors, value } = validate(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'validation', details: errors });

  const keys = Object.keys(value);
  if (!keys.length) return res.status(400).json({ error: 'no_fields' });

  const setSql = keys.map(k => `${k} = @${k}`).join(', ');
  db.db.prepare(
    `UPDATE projects SET ${setSql}, updated_at = datetime('now') WHERE id = @id`
  ).run({ ...value, id: req.params.id });

  const row = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project: serialize(row) });
});

// DELETE /api/projects/:id  (admin)  — also removes Drive files for its assets
const drive = require('../drive');
router.delete('/:id', requireAdmin, async (req, res) => {
  const row = db.db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  const assets = db.db.prepare('SELECT drive_file_id FROM assets WHERE project_id = ?').all(req.params.id);
  // best-effort Drive cleanup (don't block deletion on Drive errors)
  await Promise.allSettled(assets.map(a => drive.deleteFile(a.drive_file_id)));

  db.db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id); // cascade removes assets
  res.json({ ok: true, deleted: req.params.id });
});

module.exports = { router, serialize };
