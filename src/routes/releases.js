'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');

const router = express.Router();

// Resolve "artist title" → an Apple Music link. Admin-only: used by the editor's
// "find link" button to prefill apple_url, which the admin can then correct. The
// public site only renders saved URLs (no API calls for visitors).
//
// NOTE: Spotify auto-find was removed for now — Spotify's catalog Search API
// requires the app owner to have Premium. The spotify_url column, validation and
// public embed remain, so Spotify links can still be pasted by hand and a
// resolver can be re-added later.

// Apple Music via the free iTunes Search API (no key).
async function appleSearch(q) {
  try {
    const r = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${encodeURIComponent(q)}`);
    if (!r.ok) { console.error('[apple search]', r.status); return null; }
    const d = await r.json();
    const t = d.results && d.results[0];
    return (t && (t.trackViewUrl || t.collectionViewUrl)) || null;
  } catch (e) { console.error('[apple search]', e?.message || e); return null; }
}

// GET /api/releases/resolve?q=...  (admin)
router.get('/resolve', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'q_required' });
  const apple = await appleSearch(q);
  res.json({ apple });
});

module.exports = router;
