'use strict';
const fs = require('fs');
const { google } = require('googleapis');
const config = require('./config');
const db = require('./db');

/**
 * Build an OAuth2 client. If `withRefresh` is true, load the stored admin
 * refresh token so the client can act on the admin's Drive server-side
 * (used for uploads and for streaming images to public visitors).
 */
function oauthClient(withRefresh = false) {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  if (withRefresh) {
    const state = db.getAdminState();
    if (!state || !state.refresh_token) {
      const err = new Error('DRIVE_NOT_LINKED');
      err.code = 'DRIVE_NOT_LINKED';
      throw err;
    }
    client.setCredentials({ refresh_token: state.refresh_token });
  }
  return client;
}

function driveClient() {
  return google.drive({ version: 'v3', auth: oauthClient(true) });
}

function notLinked(cause) {
  const err = new Error('DRIVE_NOT_LINKED');
  err.code = 'DRIVE_NOT_LINKED';
  err.cause = cause;
  return err;
}

/** True when Google rejects the stored refresh token itself — the grant is gone
 *  (revoked/expired), the consent is missing a scope, or the client credentials
 *  no longer match. All three need a fresh admin login; nothing else does.
 *  Deliberately narrow: a transient 5xx or a network blip must NOT match. */
function isAuthFailure(e) {
  const oauthError = e?.response?.data?.error;      // token endpoint: invalid_grant / invalid_client
  if (oauthError === 'invalid_grant' || oauthError === 'invalid_client') return true;
  if (e?.message === 'invalid_grant' || e?.message === 'invalid_client') return true;
  // Drive API rejects an access token minted without drive.file
  if (/insufficient authentication scopes/i.test(e?.message || '')) return true;
  const reasons = (e?.errors || []).map((x) => x.reason);
  return reasons.includes('insufficientPermissions') || reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT');
}

/** Run a Drive call, converting an unusable grant into DRIVE_NOT_LINKED. The
 *  dead token is dropped so `driveLinked` stops claiming the Drive is connected
 *  and the admin sees that a re-login is needed. */
async function callDrive(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e.code === 'DRIVE_NOT_LINKED' || !isAuthFailure(e)) throw e;
    db.clearRefreshToken();
    throw notLinked(e);
  }
}

/** Build the Google consent URL. */
function authUrl(state) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',          // ← get a refresh token
    prompt: 'consent',               // ← force refresh token on re-auth
    include_granted_scopes: true,
    scope: config.google.scopes,
    state,
  });
}

/** Exchange the auth code for tokens + verified identity. */
async function exchangeCode(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  // verify the id_token to obtain a trustworthy email
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  return {
    tokens,
    profile: {
      email: (payload.email || '').toLowerCase(),
      emailVerified: !!payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub,
    },
  };
}

/** Find a folder by name at Drive root that this app created, or create it. */
async function ensureFolder(kind /* 'image' | 'audio' */) {
  const state = db.getAdminState();
  const cachedId = kind === 'audio' ? state?.audio_folder_id : state?.image_folder_id;
  const drive = driveClient();

  if (cachedId) {
    try {
      const { data } = await drive.files.get({ fileId: cachedId, fields: 'id,trashed' });
      if (data && !data.trashed) return cachedId;
    } catch (_) { /* fall through and recreate */ }
  }

  const name = kind === 'audio' ? config.drive.audioFolder : config.drive.imageFolder;
  if (!name) throw new Error(`No folder name configured for kind=${kind}`);

  // Search among files this app can see (drive.file scope → only app-created files)
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');
  const list = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 5 });

  let folderId;
  if (list.data.files && list.data.files.length) {
    folderId = list.data.files[0].id;
  } else {
    const created = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = created.data.id;
  }
  db.setFolderId(kind, folderId);
  return folderId;
}

/** Stream a file from disk to the appropriate Drive folder. Returns {id, name}.
 *  Streaming (vs. buffering in memory) keeps RAM flat regardless of file size. */
async function uploadFile({ filePath, name, mimeType, kind }) {
  return callDrive(async () => {
    const folderId = await ensureFolder(kind);
    const drive = driveClient();
    const res = await drive.files.create({
      requestBody: { name, parents: [folderId] },
      media: { mimeType, body: fs.createReadStream(filePath) },
      fields: 'id,name',
    });
    return res.data;
  });
}

/** Stream a Drive file's bytes (for the image proxy). */
async function getFileStream(fileId) {
  return callDrive(async () => {
    const drive = driveClient();
    const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
    const media = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return { stream: media.data, meta: meta.data };
  });
}

/** Fetch a Drive-generated thumbnail (small JPEG) for an image file.
 *  Returns { buffer, contentType } or null if unavailable. Buffers (not a
 *  stream) so the caller can both cache the bytes and serve them. */
async function getThumbnail(fileId, size) {
  return callDrive(async () => {
    const client = oauthClient(true);
    const drive = google.drive({ version: 'v3', auth: client });
    const { data } = await drive.files.get({ fileId, fields: 'thumbnailLink' });
    if (!data.thumbnailLink) return null;
    // thumbnailLink ends with a size hint like "=s220"; bump it to the requested size
    const url = data.thumbnailLink.replace(/=s\d+(-[a-z0-9]+)*$/i, `=s${size}`);
    const { token } = await client.getAccessToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType: res.headers.get('content-type') || 'image/jpeg' };
  });
}

/** Upload a SQLite backup file to a `portfolio_backup` Drive folder, then
 *  prune older backups beyond `keep`. Returns the uploaded file metadata. */
async function uploadBackup(filePath, name, keep = 14) {
  return callDrive(() => uploadBackupToDrive(filePath, name, keep));
}

async function uploadBackupToDrive(filePath, name, keep) {
  const drive = driveClient();
  const folderName = 'portfolio_backup';

  // find or create the backup folder (not cached — backups are infrequent)
  const q = [
    `name = '${folderName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');
  const list = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
  let folderId = list.data.files && list.data.files[0] && list.data.files[0].id;
  if (!folderId) {
    const created = await drive.files.create({
      requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = created.data.id;
  }

  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(filePath) },
    fields: 'id,name,size',
  });

  // prune oldest backups, keeping the most recent `keep`
  try {
    const existing = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });
    const files = existing.data.files || [];
    for (const f of files.slice(keep)) {
      await drive.files.delete({ fileId: f.id }).catch(() => {});
    }
  } catch (_) { /* pruning is best-effort */ }

  return res.data;
}

/** Permanently delete a Drive file (best-effort). */
async function deleteFile(fileId) {
  try {
    await driveClient().files.delete({ fileId });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  authUrl, exchangeCode, ensureFolder, uploadFile, getFileStream, getThumbnail, uploadBackup, deleteFile, oauthClient,
  isAuthFailure, // exported so the token-dropping guard can be tested directly
};
