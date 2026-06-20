# Maintenance Handoff

Last reviewed: 2026-06-20 KST

This project is a one-admin sound engineer portfolio. It runs as a Node/Express
app with static HTML frontends, SQLite on a persistent Render disk, Google OAuth
for admin login, and Google Drive for private media storage.

## Current Source Of Truth

- `CLAUDE.md`: most complete architecture and operational notes.
- `TODO.md`: current backlog and historical decisions.
- `render.yaml`: production deployment, disk, cron backup, and env var shape.
- `README.md`: user setup guide. Refreshed 2026-06-20 (routes, API table,
  categories, upload limit, light theme) so it now matches the code.

## Production

- URL: `https://vozong-portfolio.onrender.com`
- Repo remote: `origin https://github.com/vozong-git/vozong-portfolio.git`
- Branch: `main`
- Render deploy: `autoDeploy: true`, so `git push origin main` triggers deploy.
- Runtime: Render Starter with persistent disk mounted at `/var/data`.
- DB path in production: `/var/data/portfolio.db`.
- Backup: Render cron calls `POST /api/backup` daily at 18:00 UTC with
  `X-Backup-Token`; the web service snapshots SQLite and uploads to Drive.

After changes, always:

```bash
npm run build:css
node --check server.js
node --check src/auth.js
node --check src/routes/projects.js
git diff --check
git add <changed files>
git commit -m "<message>"
git push origin main
curl -I --max-time 20 https://vozong-portfolio.onrender.com/
```

## App Shape

- `server.js`: middleware, CSP, rate limits, route mounting, admin page gates,
  static serving, startup. Admin gates must stay before `express.static`.
- `src/auth.js`: Google OAuth, JWT session cookie, `requireAdmin`,
  `isAdminUser`. Any admin-only read should use `isAdminUser` or
  `requireAdmin`, not a raw `role === 'admin'` check.
- `src/db.js`: SQLite schema, migrations, encrypted refresh token storage,
  contact and YouTube cache helpers.
- `src/drive.js`: OAuth client, Drive folders, upload, raw stream, thumbnails,
  backup upload and pruning.
- `src/routes/projects.js`: project CRUD, public/admin list behavior, category
  rules, validation, list payload optimization.
- `src/routes/assets.js`: private Drive asset proxy and thumbnail disk cache.
- `src/routes/upload.js`: disk-backed multer upload to avoid memory spikes.
- `src/routes/contact.js`: public obfuscated contact payload and admin full
  contact payload.
- `src/routes/backup.js`: manual/admin backup and cron token path.
- `src/routes/youtube.js`: YouTube Data API lookup plus permanent SQLite cache.
- `src/routes/theme.js`: GET/PUT the site-wide accent preset (admin to set).
  server.js also serves `/theme.js` (a head-loaded setter) from admin_state.
- `src/routes/releases.js`: admin-only Spotify (Client Credentials) + Apple
  (iTunes Search) link resolver for the editor's auto-find. Public pages embed
  the saved spotify_url/apple_url only; no API calls for visitors.
- `src/routes/projects.js` also exposes `GET /stats` (admin) for the dashboard
  stats strip.
- `public/*.html`: static frontends. There is no framework build step besides
  Tailwind CSS. Theme tokens are CSS variables in `src/styles/app.css`
  (light/dark via prefers-color-scheme + four `data-theme` accent presets);
  rebuild `app.css` whenever Tailwind classes change.
- `public/assets/common.js`: shared browser helpers, cards, sidebar, toast,
  scroll-to-top.

## Data And Privacy Rules

- Only `ADMIN_EMAIL` can become admin. A stale JWT with `role: admin` is not
  enough; use `isAdminUser`.
- Non-admin users only see `published` projects.
- Assets for draft projects must 404 for non-admin users.
- Drive files are not made public. `/api/assets/:id/raw` proxies bytes.
- Drive refresh tokens are encrypted in SQLite with `TOKEN_ENC_KEY`. Changing
  that key requires relinking Google Drive.
- Contact email/phone are obfuscated in public JSON and revealed client-side
  only after click.

## Design And UX

- Theme is warm light Studio Noir: cream background, neutral surfaces, coral
  accent. Avoid reintroducing dark/electric-blue README-era styling.
- Sidebar categories: Overview, Studio Work, Playback & Live Tune, Live Sound,
  Contact. Admin stays separate at the bottom and is hidden unless admin.
- Admin dashboard filters are status, category, and YouTube availability
  (`ALL YOUTUBE`, `YOUTUBE 있음`, `YOUTUBE 없음`). These persist in
  `sessionStorage`, and `Save & Next` in the project form follows the same
  filter set.
- Public project detail opens as a floating modal on desktop (md+, over the
  untouched list) and inline in #projectArea on mobile (list scroll restored on
  return). Both push a history entry so Back / iOS swipe-back / Esc / backdrop
  all return to the list via one popstate path.
- iOS hides the floating scroll-to-top button because iOS already has
  status-bar tap-to-top.

## Known Gaps

- There is no formal test runner or linter. Current verification is syntax
  checks, CSS build, import smoke checks, and targeted curl checks.
- `npm run build:css` currently warns that Browserslist/caniuse-lite is old.
  This is not a runtime failure.
- Major dependency upgrades are intentionally deferred: Express 5, Helmet 8,
  express-rate-limit 8, Tailwind 4, CSP nonce migration.
- Spotify release auto-find needs the app owner's Spotify account to be Premium
  — the catalog Search API 403s otherwise ("Active premium subscription
  required for the owner of the app"). Keys being set is not enough. Apple Music
  auto-find (iTunes Search) is unaffected, and pasted Spotify links still embed.
- Optional future work: lightweight automated API smoke tests,
  admin pagination/"load more", monitoring/error reporting, optional audio UI,
  featured/curated work, custom domain.

## Recent Codex Takeover Notes

- Commit `00d9e87` tightened admin checks, added stricter project validation,
  made `server.js` import-safe, and moved Contact next to category navigation.
- Deployment for `00d9e87` was verified on Render by checking HTTP 200 and the
  deployed HTML containing Contact above the Admin-only footer.
- Commit `51b5e95` added the admin YouTube availability filter and verified
  production health after Render deploy.

## 2026-06-20 Session (UI/UX + features)

Range `1e522c5..6e6b648`, all deployed and verified on Render (HTTP 200,
admin endpoints 401 unauth, CSP, migration columns present). Highlights:

- Theming: color tokens moved to CSS variables; four accent presets
  (ember/sage/dusk/plum) switchable from the admin sidebar; dark mode follows
  the OS via prefers-color-scheme; `/theme.js` applies the saved preset with no
  flash.
- Layout fixes: removed a 256px horizontal overflow when the sidebar showed;
  admin list is wrap-to-fit cards on mobile and reveals ARTIST/TYPE only at lg+;
  public cards softened to 8px corners.
- Project detail: desktop modal overlay (inline on mobile) with shared history
  back-handling and background scroll lock; contact also opens as a modal with a
  gentle 0.4px backdrop-blur ramp.
- Editor: System Status panel shows the current cover/title/artist; admin list
  scroll restored after an editor round-trip; Save & Next no longer drops out
  when a save removes the project from the active filter.
- Release links: projects gained spotify_url/apple_url with embeds on the public
  detail and an admin auto-find (Apple via free iTunes Search; Spotify via
  Client Credentials — see Spotify Premium caveat in Known Gaps).
- Admin-only stats strip via `GET /api/projects/stats`.
