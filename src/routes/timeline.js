'use strict';
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

const serialize = (t) => ({
  id: t.id, role: t.role, venue: t.venue, period: t.period,
  is_current: !!t.is_current, sort_order: t.sort_order, created_at: t.created_at,
});

// GET /api/timeline (public)
router.get('/', (_req, res) => {
  const rows = db.db.prepare(
    'SELECT * FROM timeline ORDER BY is_current DESC, sort_order ASC, id DESC'
  ).all();
  res.json({ timeline: rows.map(serialize) });
});

function validate(body, partial = false) {
  const errors = [];
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (!partial || has('role')) {
    const r = (body.role || '').toString().trim();
    if (!r) errors.push('role is required');
    out.role = r;
  }
  if (has('venue')) out.venue = (body.venue ?? '').toString().trim() || null;
  if (has('period')) out.period = (body.period ?? '').toString().trim() || null;
  if (has('is_current')) out.is_current = body.is_current ? 1 : 0;
  if (has('sort_order')) out.sort_order = parseInt(body.sort_order, 10) || 0;
  return { errors, value: out };
}

// POST /api/timeline (admin)
router.post('/', requireAdmin, (req, res) => {
  const { errors, value } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'validation', details: errors });
  const info = db.db.prepare(`
    INSERT INTO timeline (role, venue, period, is_current, sort_order)
    VALUES (@role, @venue, @period, @is_current, @sort_order)
  `).run({
    role: value.role, venue: value.venue ?? null, period: value.period ?? null,
    is_current: value.is_current ?? 0, sort_order: value.sort_order ?? 0,
  });
  const row = db.db.prepare('SELECT * FROM timeline WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item: serialize(row) });
});

// PATCH /api/timeline/:id (admin)
router.patch('/:id', requireAdmin, (req, res) => {
  const existing = db.db.prepare('SELECT id FROM timeline WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { errors, value } = validate(req.body || {}, true);
  if (errors.length) return res.status(400).json({ error: 'validation', details: errors });
  const keys = Object.keys(value);
  if (!keys.length) return res.status(400).json({ error: 'no_fields' });
  const setSql = keys.map(k => `${k} = @${k}`).join(', ');
  db.db.prepare(`UPDATE timeline SET ${setSql} WHERE id = @id`).run({ ...value, id: req.params.id });
  const row = db.db.prepare('SELECT * FROM timeline WHERE id = ?').get(req.params.id);
  res.json({ item: serialize(row) });
});

// DELETE /api/timeline/:id (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.db.prepare('DELETE FROM timeline WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

module.exports = router;
