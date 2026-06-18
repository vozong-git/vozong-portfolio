'use strict';
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');

const router = express.Router();

const clean = (v) => (v == null ? null : String(v).trim() || null);

// Lightly obfuscate the public payload: base64 hides the literal '@'/digits so
// naive email/phone regex scrapers (and the rendered DOM before a human clicks
// to reveal) never see a harvestable address. The client decodes on demand.
const enc = (v) => (v ? Buffer.from(String(v), 'utf8').toString('base64') : null);

// GET /api/contact (public) — email/phone returned obfuscated, never plaintext
router.get('/', (_req, res) => {
  const c = db.getContact() || {};
  res.json({
    contact: {
      headline: c.headline || null,
      location: c.location || null,
      email_b64: enc(c.email),
      phone_b64: enc(c.phone),
    },
  });
});

// GET /api/contact/full (admin) — plaintext, for the edit form prefill
router.get('/full', requireAdmin, (_req, res) => {
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
