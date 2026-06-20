'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');

const router = express.Router();

// Resolve "artist title" → release links. Admin-only: it's used by the editor's
// "find links" button to prefill the spotify_url / apple_url fields, which the
// admin can then correct. The public site only renders the saved URLs (no API
// calls, no quota), so this never runs for visitors.

// ── Spotify (Client Credentials flow; needs a free Spotify app) ──
let spToken = null, spExp = 0;
async function spotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (spToken && Date.now() < spExp) return spToken;
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!r.ok) { console.error('[spotify token]', r.status, await r.text().catch(() => '')); return null; }
    const d = await r.json();
    spToken = d.access_token;
    spExp = Date.now() + ((d.expires_in || 3600) - 60) * 1000;
    return spToken;
  } catch (e) { console.error('[spotify token]', e?.message || e); return null; }
}
async function spotifySearch(q) {
  const tok = await spotifyToken();
  if (!tok) return { url: null, error: null };
  try {
    const r = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error('[spotify search]', r.status, body);
      // Spotify now blocks catalog search for apps whose owner isn't Premium
      const error = (r.status === 403 && /premium/i.test(body)) ? 'premium_required' : 'api_error';
      return { url: null, error };
    }
    const d = await r.json();
    const t = d.tracks && d.tracks.items && d.tracks.items[0];
    return { url: (t && t.external_urls && t.external_urls.spotify) || null, error: null };
  } catch (e) { console.error('[spotify search]', e?.message || e); return { url: null, error: 'error' }; }
}

// ── Apple Music (free iTunes Search API, no key) ──
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
  const [sp, apple] = await Promise.all([spotifySearch(q), appleSearch(q)]);
  res.json({
    spotify: sp.url, apple,
    spotifyError: sp.error,
    spotifyConfigured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
  });
});

module.exports = router;
