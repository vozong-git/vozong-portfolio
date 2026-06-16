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
  const folderId = await ensureFolder(kind);
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id,name',
  });
  return res.data;
}

/** Stream a Drive file's bytes (for the image proxy). */
async function getFileStream(fileId) {
  const drive = driveClient();
  const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
  const media = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return { stream: media.data, meta: meta.data };
}

/** Fetch a Drive-generated thumbnail (small JPEG) for an image file.
 *  Returns { body (web stream), contentType } or null if unavailable. */
async function getThumbnail(fileId, size) {
  const client = oauthClient(true);
  const drive = google.drive({ version: 'v3', auth: client });
  const { data } = await drive.files.get({ fileId, fields: 'thumbnailLink' });
  if (!data.thumbnailLink) return null;
  // thumbnailLink ends with a size hint like "=s220"; bump it to the requested size
  const url = data.thumbnailLink.replace(/=s\d+(-[a-z0-9]+)*$/i, `=s${size}`);
  const { token } = await client.getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok || !res.body) return null;
  return { body: res.body, contentType: res.headers.get('content-type') || 'image/jpeg' };
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
  authUrl, exchangeCode, ensureFolder, uploadFile, getFileStream, getThumbnail, deleteFile, oauthClient,
};
