'use strict';
const express = require('express');
const db = require('../db');
const { isAdminUser } = require('../auth');

const router = express.Router();

const SEARCH_API = 'https://www.googleapis.com/youtube/v3/search';

// Resolve a query to the top YouTube video id, using a cache so the Data API is
// called at most once per distinct query. `search.list` costs 100 of the 10k
// daily quota units, so set { allowApi: false } on hot paths (e.g. public page
// views) to serve cached hits only and skip the API. Returns { videoId, ... }.
async function lookup(q, { allowApi = true } = {}) {
  const cached = db.getYtCache(q);
  if (cached) return { videoId: cached.video_id || null, source: 'cache' };

  if (!allowApi) return { videoId: null, reason: 'cache_miss' };

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
    if (!isAdminUser(req.user)) return res.status(401).json({ error: 'unauthorized' });
    const q = String(req.query.q).trim().slice(0, 200);
    if (!q) return res.status(400).json({ error: 'q_required' });
    return res.json(await lookup(q));
  }

  const id = parseInt(req.query.projectId, 10);
  if (!id) return res.status(400).json({ error: 'projectId_required' });

  const p = db.db.prepare('SELECT id, client_name, title, status, youtube_url FROM projects WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'not_found' });

  const isAdmin = isAdminUser(req.user);
  if (p.status !== 'published' && !isAdmin) return res.status(404).json({ error: 'not_found' });

  // an admin-saved link always wins — no need to resolve
  const saved = ytId(p.youtube_url);
  if (saved) return res.json({ videoId: saved, source: 'saved' });

  const q = [p.client_name, p.title].filter(Boolean).join(' ').trim();
  if (!q) return res.json({ videoId: null, reason: 'empty_query' });

  // Portfolio/detail views never spend API quota: serve a cached hit if we have
  // one, otherwise let the frontend keep its plain search-link fallback. Fresh
  // resolution happens only via the admin "find video" button (?q=) below.
  return res.json(await lookup(q, { allowApi: false }));
});

// GET /api/youtube/oembed?v=VIDEOID — video title via YouTube oEmbed (no key,
// no quota). Used by the editor to show the matched video's title.
router.get('/oembed', async (req, res) => {
  const v = String(req.query.v || '').trim();
  if (!/^[\w-]{11}$/.test(v)) return res.status(400).json({ error: 'bad_id' });
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v)}`);
    if (!r.ok) return res.json({ title: null });
    const d = await r.json();
    res.json({ title: d.title || null, author: d.author_name || null });
  } catch (e) { console.error('[youtube oembed]', e?.message || e); res.json({ title: null }); }
});

// Extract an 11-char video id from any common YouTube URL form.
function ytId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

module.exports = router;
