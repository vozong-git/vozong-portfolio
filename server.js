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
const timelineRouter = require('./src/routes/timeline');

db.init(); // ensure schema exists

const app = express();
app.set('trust proxy', 1);

// ── security headers (CSP relaxed for the Tailwind/fonts CDNs the Stitch UI uses) ──
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
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
app.use('/api/timeline', apiLimiter, timelineRouter);

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
app.get(['/admin', '/admin.html'], gateAdminPage('admin.html'));
app.get(['/new', '/project-form.html'], gateAdminPage('project-form.html'));

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

app.listen(config.port, () => {
  console.log(`\n  Studio Noir Portfolio`);
  console.log(`  ▸ ${config.baseUrl}  (env: ${config.env})`);
  console.log(`  ▸ admin: ${config.adminEmail || '(ADMIN_EMAIL not set)'}`);
  console.log(`  ▸ drive image folder: ${config.drive.imageFolder}\n`);
});

module.exports = app;
