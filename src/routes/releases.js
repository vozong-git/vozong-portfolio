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

// Apple Music via the free iTunes Search API (no key). Tries one store at a time.
async function appleSearchStore(q, country) {
  try {
    const r = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=1&country=${country}&term=${encodeURIComponent(q)}`);
    if (!r.ok) { console.error('[apple search]', country, r.status); return null; }
    const d = await r.json();
    const t = d.results && d.results[0];
    return (t && (t.trackViewUrl || t.collectionViewUrl)) || null;
  } catch (e) { console.error('[apple search]', country, e?.message || e); return null; }
}

// This is a Korean studio's portfolio, so domestic releases are missing from the
// default US store (e.g. "검정치마 안녕" → 0 hits in US, 1 in KR). Search the KR
// store first, then fall back to US for international artists.
async function appleSearch(q) {
  return (await appleSearchStore(q, 'KR')) || (await appleSearchStore(q, 'US'));
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

// GET /api/releases/apple-preview?url=...  (public) — cover/artist/title +
// a 30s preview audio URL for an Apple Music link via the free iTunes Lookup
// API (no key). The editor uses the artwork to confirm a match; the public
// detail uses `preview` to play inline without showing the artwork. Cached
// in-memory so repeated views don't re-hit iTunes.
const appleCache = new Map();
router.get('/apple-preview', async (req, res) => {
  const url = String(req.query.url || '').trim();
  const id = appleId(url);
  if (!id) return res.status(400).json({ error: 'bad_url' });
  if (appleCache.has(id)) return res.json(appleCache.get(id));
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
    if (!r.ok) { console.error('[apple lookup]', r.status); return res.json({ title: null }); }
    const d = await r.json();
    const t = d.results && d.results[0];
    const out = t ? {
      title: t.trackName || t.collectionName || null,
      artist: t.artistName || null,
      artwork: t.artworkUrl100 ? t.artworkUrl100.replace('100x100', '300x300') : null,
      preview: t.previewUrl || null,
      url: t.trackViewUrl || t.collectionViewUrl || url,
    } : { title: null };
    if (appleCache.size > 500) appleCache.clear();
    appleCache.set(id, out);
    res.json(out);
  } catch (e) { console.error('[apple lookup]', e?.message || e); res.json({ title: null }); }
});

module.exports = router;
