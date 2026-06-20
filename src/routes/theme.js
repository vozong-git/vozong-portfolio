'use strict';
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

// The four selectable accent presets. The actual colors (light + dark) live in
// src/styles/app.css under :root[data-theme="..."]; this list is the allow-list
// and the source of labels for the admin picker.
const THEMES = [
  { key: 'ember', label: 'Ember', swatch: '#C15F3C' },
  { key: 'sage', label: 'Sage', swatch: '#5E7259' },
  { key: 'dusk', label: 'Dusk', swatch: '#516E8B' },
  { key: 'plum', label: 'Plum', swatch: '#87566C' },
];
const KEYS = THEMES.map((t) => t.key);

// GET /api/theme (public) — current preset + the available presets for the UI
router.get('/', (_req, res) => res.json({ theme: db.getTheme(), themes: THEMES }));

// PUT /api/theme (admin) — switch the site-wide accent preset
router.put('/', requireAdmin, (req, res) => {
  const t = String(req.body && req.body.theme || '').trim();
  if (!KEYS.includes(t)) return res.status(400).json({ error: 'invalid_theme' });
  db.setTheme(t);
  res.json({ theme: t });
});

module.exports = { router, THEMES, KEYS };
