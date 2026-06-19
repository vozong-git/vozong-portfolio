'use strict';
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');
const drive = require('./drive');

const router = express.Router();

/* ── session cookie (signed JWT, httpOnly) ── */
function issueSession(res, profile) {
  const token = jwt.sign(
    { email: profile.email, name: profile.name, picture: profile.picture, role: 'admin' },
    config.sessionSecret,
    { expiresIn: '30d' }
  );
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function readSession(req) {
  const raw = req.cookies?.[config.cookieName];
  if (!raw) return null;
  try {
    return jwt.verify(raw, config.sessionSecret);
  } catch {
    return null;
  }
}

function isAdminUser(user) {
  return !!(
    user &&
    user.role === 'admin' &&
    user.email &&
    user.email.toLowerCase() === config.adminEmail
  );
}

/** Express middleware: attaches req.user (or null). */
function attachUser(req, _res, next) {
  req.user = readSession(req);
  next();
}

/** Express middleware: require an authenticated admin. */
function requireAdmin(req, res, next) {
  const user = req.user || readSession(req);
  if (!isAdminUser(user)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

/* ── routes ── */

// GET /api/auth/me  → current session info (public)
router.get('/me', (req, res) => {
  const user = req.user || readSession(req);
  if (!user) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    email: user.email,
    name: user.name,
    picture: user.picture,
    isAdmin: isAdminUser(user),
  });
});

// GET /api/auth/google  → kick off OAuth
router.get('/google', (req, res) => {
  try {
    config.assertGoogleConfigured();
  } catch (e) {
    return res.status(500).send(`Server not configured: ${e.message}`);
  }
  // CSRF state, double-submitted via short-lived cookie
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true, secure: config.isProd, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/',
  });
  res.redirect(drive.authUrl(state));
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/login.html?error=' + encodeURIComponent(String(error)));
  if (!code) return res.redirect('/login.html?error=missing_code');
  if (!state || state !== req.cookies?.oauth_state) {
    return res.redirect('/login.html?error=bad_state');
  }
  res.clearCookie('oauth_state', { path: '/' });

  try {
    const { tokens, profile } = await drive.exchangeCode(String(code));

    if (!profile.emailVerified) {
      return res.redirect('/login.html?error=email_unverified');
    }
    // ── single-admin allowlist: only YOUR Google account passes ──
    if (profile.email !== config.adminEmail) {
      return res.redirect('/login.html?error=not_authorized');
    }

    // persist identity + refresh token (so Drive uploads work long-term)
    db.saveAdminIdentity({
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      refreshToken: tokens.refresh_token, // may be undefined on repeat consent; db keeps the old one
    });

    issueSession(res, profile);
    res.redirect('/admin.html');
  } catch (e) {
    console.error('[oauth callback]', e?.message || e);
    res.redirect('/login.html?error=oauth_failed');
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ ok: true });
});

module.exports = { router, attachUser, requireAdmin, readSession, isAdminUser };
