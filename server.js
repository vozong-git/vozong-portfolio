'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const db = require('./src/db');
const { router: authRouter, attachUser } = require('./src/auth');
const projects = require('./src/routes/projects');
const uploadRouter = require('./src/routes/upload');
const assetsRouter = require('./src/routes/assets');
const contactRouter = require('./src/routes/contact');
const backupRouter = require('./src/routes/backup');
const youtubeRouter = require('./src/routes/youtube');
const themeRouter = require('./src/routes/theme');

db.init(); // ensure schema exists

const app = express();
app.set('trust proxy', 1);

// ── security headers (CSS is now built locally; only Google Fonts remain remote) ──
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://www.youtube.com'], // YT IFrame API (embed-blocked detection)
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com', 'https://img.youtube.com'],
      'connect-src': ["'self'"],
      'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
      'frame-ancestors': ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(attachUser); // populates req.user from session cookie

// ── rate limits ──
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// ── API routes ──
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/projects', apiLimiter, projects.router);
app.use('/api/upload', apiLimiter, uploadRouter);
app.use('/api/assets', apiLimiter, assetsRouter);
app.use('/api/contact', apiLimiter, contactRouter);
app.use('/api/backup', apiLimiter, backupRouter);
app.use('/api/youtube', apiLimiter, youtubeRouter);
app.use('/api/theme', apiLimiter, themeRouter.router);

// Tiny script loaded synchronously in each page <head> so the saved accent
// preset is applied before first paint (no flash). Public, always fresh.
app.get('/theme.js', (_req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-cache');
  res.send(`document.documentElement.dataset.theme=${JSON.stringify(db.getTheme())};`);
});

app.get('/api/health', (_req, res) => {
  const linked = !!(db.getAdminState() && db.getAdminState().refresh_token);
  res.json({ ok: true, driveLinked: linked, env: config.env });
});

// gate admin pages BEFORE static, so unauthenticated visitors are bounced to login
function gateAdminPage(file) {
  return (req, res) => {
    if (!req.user || req.user.email !== config.adminEmail) {
      return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', file));
  };
}
// NB: list every alias that resolves to each file — including the bare basename,
// because express.static({ extensions: ['html'] }) below would otherwise serve
// e.g. GET /project-form → project-form.html unauthenticated, bypassing the gate.
app.get(['/admin', '/admin.html'], gateAdminPage('admin.html'));
app.get(['/new', '/project-form', '/project-form.html'], gateAdminPage('project-form.html'));
app.get(['/contact-edit', '/contact-form', '/contact-form.html'], gateAdminPage('contact-form.html'));

// ── static frontend (public assets + non-gated pages) ──
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── error + 404 ──
app.use((req, res) => res.status(404).json({ error: 'not_found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[error]', err?.message || err);
  res.status(500).json({ error: 'server_error' });
});

// Keep the process alive on stray async errors instead of crashing the whole
// service (a single unhandled rejection would otherwise take the site down).
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err?.stack || err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err?.stack || err));

// Bind explicitly to 0.0.0.0 so Render (and other PaaS) detect the open port
// immediately — without this Node may bind IPv6-only and Render reports
// "no-server" for several minutes after each deploy.
function start() {
  return app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n  Studio Noir Portfolio`);
    console.log(`  ▸ ${config.baseUrl}  (env: ${config.env})`);
    console.log(`  ▸ admin: ${config.adminEmail || '(ADMIN_EMAIL not set)'}`);
    console.log(`  ▸ drive image folder: ${config.drive.imageFolder}\n`);

    if (config.isProd) {
      if (config.sessionSecret === 'insecure-dev-secret-change-me') {
        console.warn('  ⚠️  [WARNING] SESSION_SECRET is using the default insecure value in production! Configure it in your environment.');
      }
      if (config.tokenEncKey === 'insecure-dev-enc-key-change-me-please-32b') {
        console.warn('  ⚠️  [WARNING] TOKEN_ENC_KEY is using the default insecure value in production! Configure it in your environment.');
      }
    }
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
module.exports.start = start;
