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

// Pull the track/album id out of a music.apple.com URL (the ?i= track id wins,
// else the numeric id in the path = album).
function appleId(url) {
  const u = String(url);
  const track = u.match(/[?&]i=(\d+)/);
  if (track) return track[1];
  const album = u.match(/\/(\d+)(?:[?#/]|$)/);
  return album ? album[1] : null;
}

// GET /api/releases/apple-preview?url=...  (admin) — cover/artist/title for an
// Apple Music link via the free iTunes Lookup API (no key).
router.get('/apple-preview', requireAdmin, async (req, res) => {
  const url = String(req.query.url || '').trim();
  const id = appleId(url);
  if (!id) return res.status(400).json({ error: 'bad_url' });
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
    if (!r.ok) { console.error('[apple lookup]', r.status); return res.json({ title: null }); }
    const d = await r.json();
    const t = d.results && d.results[0];
    if (!t) return res.json({ title: null });
    res.json({
      title: t.trackName || t.collectionName || null,
      artist: t.artistName || null,
      artwork: t.artworkUrl100 ? t.artworkUrl100.replace('100x100', '300x300') : null,
      url: t.trackViewUrl || t.collectionViewUrl || url,
    });
  } catch (e) { console.error('[apple lookup]', e?.message || e); res.json({ title: null }); }
});

module.exports = router;
