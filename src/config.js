'use strict';
require('dotenv').config();

const path = require('path');

function req(name) {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    // Don't crash at import time so `npm run init-db` etc. still work;
    // routes that need a value will surface a clear error instead.
    return '';
  }
  return v.trim();
}

const PORT = parseInt(process.env.PORT || '8080', 10);
// On Render, RENDER_EXTERNAL_URL is injected automatically (https://<svc>.onrender.com),
// so BASE_URL can be left unset in that environment.
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`)
  .replace(/\/+$/, '');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: PORT,
  baseUrl: BASE_URL,

  google: {
    clientId: req('GOOGLE_CLIENT_ID'),
    clientSecret: req('GOOGLE_CLIENT_SECRET'),
    redirectUri: `${BASE_URL}/api/auth/google/callback`,
    // openid/email/profile  → identity (who is logging in)
    // drive.file            → app can only see/manage files IT created (least privilege)
    scopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
    ],
  },

  adminEmail: (req('ADMIN_EMAIL') || '').toLowerCase(),

  sessionSecret: req('SESSION_SECRET') || 'insecure-dev-secret-change-me',
  tokenEncKey: req('TOKEN_ENC_KEY') || 'insecure-dev-enc-key-change-me-please-32b',

  drive: {
    imageFolder: req('DRIVE_IMAGE_FOLDER') || 'portfolio_image',
    audioFolder: req('DRIVE_AUDIO_FOLDER') || '',
  },

  maxUploadBytes: (parseInt(process.env.MAX_UPLOAD_MB || '100', 10)) * 1024 * 1024,

  dbPath: path.resolve(process.cwd(), process.env.DB_PATH || './data/portfolio.db'),

  cookieName: 'sn_session',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

config.assertGoogleConfigured = function () {
  const missing = [];
  if (!config.google.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.google.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!config.adminEmail) missing.push('ADMIN_EMAIL');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}. See .env.example`);
  }
};

module.exports = config;
