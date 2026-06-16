'use strict';
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

const clean = (v) => (v == null ? null : String(v).trim() || null);

// GET /api/contact (public)
router.get('/', (_req, res) => {
  const c = db.getContact() || { email: null, phone: null, location: null, headline: null };
  res.json({ contact: c });
});

// PUT /api/contact (admin)
router.put('/', requireAdmin, (req, res) => {
  const b = req.body || {};
  db.saveContact({
    email: clean(b.email),
    phone: clean(b.phone),
    location: clean(b.location),
    headline: clean(b.headline),
  });
  res.json({ contact: db.getContact() });
});

module.exports = router;
