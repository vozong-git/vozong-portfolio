'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();

const SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';

// GET /api/youtube/resolve?projectId=123  (public)
// Resolves a project's "artist title" to the top YouTube video and returns its
// id, so the detail page can link straight to the video's watch page (which
// plays embedding-disabled videos, unlike the results-page inline preview).
//
// Keyed by projectId (not an arbitrary q) so only the ~hundreds of real project
// queries can ever hit the API, and every result is cached permanently — the
// YouTube Data API is called at most once per distinct query.
router.get('/resolve', async (req, res) => {
  const id = parseInt(req.query.projectId, 10);
  if (!id) return res.status(400).json({ error: 'projectId_required' });

  const p = db.db.prepare('SELECT id, client_name, title, status, youtube_url FROM projects WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'not_found' });

  const isAdmin = req.user && req.user.role === 'admin';
  if (p.status !== 'published' && !isAdmin) return res.status(404).json({ error: 'not_found' });

  // an admin-saved link always wins — no need to resolve
  const saved = ytId(p.youtube_url);
  if (saved) return res.json({ videoId: saved, source: 'saved' });

  const q = [p.client_name, p.title].filter(Boolean).join(' ').trim();
  if (!q) return res.json({ videoId: null, reason: 'empty_query' });

  const cached = db.getYtCache(q);
  if (cached) return res.json({ videoId: cached.video_id || null, source: 'cache' });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.json({ videoId: null, reason: 'no_api_key' });

  try {
    const url = `${SEARCH_API}?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) {
      // transient/quota error — don't cache, fall back to client-side search link
      console.error('[youtube resolve]', r.status, await r.text().catch(() => ''));
      return res.json({ videoId: null, reason: 'api_error' });
    }
    const data = await r.json();
    const videoId = (data.items && data.items[0] && data.items[0].id && data.items[0].id.videoId) || '';
    db.putYtCache(q, videoId); // cache positive AND negative results permanently
    return res.json({ videoId: videoId || null, source: 'api' });
  } catch (e) {
    console.error('[youtube resolve]', e?.message || e);
    return res.json({ videoId: null, reason: 'error' });
  }
});

// Extract an 11-char video id from any common YouTube URL form.
function ytId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

module.exports = router;
