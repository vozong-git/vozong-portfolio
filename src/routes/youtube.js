'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();

const SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';

// Resolve a query to the top YouTube video id, using a permanent cache so the
// Data API is called at most once per distinct query. Returns { videoId, ... }.
async function lookup(q) {
  const cached = db.getYtCache(q);
  if (cached) return { videoId: cached.video_id || null, source: 'cache' };

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { videoId: null, reason: 'no_api_key' };

  try {
    const url = `${SEARCH_API}?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) {
      console.error('[youtube resolve]', r.status, await r.text().catch(() => ''));
      return { videoId: null, reason: 'api_error' };
    }
    const data = await r.json();
    const videoId = (data.items && data.items[0] && data.items[0].id && data.items[0].id.videoId) || '';
    db.putYtCache(q, videoId); // cache positive AND negative results permanently
    return { videoId: videoId || null, source: 'api' };
  } catch (e) {
    console.error('[youtube resolve]', e?.message || e);
    return { videoId: null, reason: 'error' };
  }
}

// GET /api/youtube/resolve
//   ?projectId=123  (public)  — server builds "artist title" from the project,
//                               used by the detail page to upgrade its link.
//   ?q=...          (admin)   — resolve an arbitrary query, used by the edit
//                               form's "find video" button. Admin-only so
//                               arbitrary queries can't drain the API quota.
router.get('/resolve', async (req, res) => {
  if (req.query.q != null) {
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) return res.status(401).json({ error: 'unauthorized' });
    const q = String(req.query.q).trim().slice(0, 200);
    if (!q) return res.status(400).json({ error: 'q_required' });
    return res.json(await lookup(q));
  }

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

  return res.json(await lookup(q));
});

// Extract an 11-char video id from any common YouTube URL form.
function ytId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

module.exports = router;
