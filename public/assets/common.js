/* Studio Noir — shared client helpers */
const SN = {
  CATEGORY_LABELS: { studio: 'Studio Work', live: 'Live Sound', playback: 'Playback', custom: 'Custom' },

  async api(method, url, body, isForm = false) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (body && isForm) { opts.body = body; }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch { /* non-json (e.g. raw) */ }
    if (!res.ok) {
      const msg = (data && (data.message || (data.details && data.details.join(', ')) || data.error)) || res.statusText;
      const e = new Error(msg); e.status = res.status; e.data = data; throw e;
    }
    return data;
  },

  async me() {
    try { return await SN.api('GET', '/api/auth/me'); }
    catch { return { authenticated: false }; }
  },

  toast(msg, kind = 'ok', ms = 2600) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.className = `toast ${kind === 'err' ? 'err' : 'ok'}`;
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms);
  },

  escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  catLabel(p) {
    if (p.category === 'custom' && p.custom_category) return p.custom_category;
    return SN.CATEGORY_LABELS[p.category] || p.category;
  },

  tagChip(t) {
    return `<span class="bg-tertiary-container/10 text-tertiary-container border-l-2 border-tertiary-container px-2 py-0.5 font-label-caps text-[9px] rounded-r">${SN.escape(t)}</span>`;
  },

  /* Studio project card (matches Stitch export markup) */
  projectCard(p) {
    const cover = p.cover_url
      ? `<img alt="${SN.escape(p.title)}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${p.cover_url}?thumb=200"/>`
      : `<div class="w-full h-full flex items-center justify-center text-outline"><span class="material-symbols-outlined">graphic_eq</span></div>`;
    const tags = (p.tags && p.tags.length)
      ? p.tags.map(SN.tagChip).join('')
      : SN.tagChip(SN.catLabel(p).toUpperCase());
    return `
    <article data-id="${p.id}" tabindex="0" role="button" aria-label="${SN.escape(p.title)}" class="bg-surface-container-high border border-outline-variant rounded p-4 hover:border-primary-fixed-dim focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim transition-colors group flex gap-4 items-center cursor-pointer">
      <div class="w-20 h-20 bg-surface-container-lowest rounded overflow-hidden flex-shrink-0 relative">${cover}</div>
      <div class="flex flex-col gap-1 overflow-hidden">
        <span class="font-metadata-sm text-metadata-sm text-primary-fixed-dim truncate">${SN.escape(p.client_name || '—')}</span>
        <h4 class="font-body-md text-body-md font-semibold text-on-surface truncate">${SN.escape(p.title)}</h4>
        <div class="flex items-center gap-2 mt-1 flex-wrap">${tags}</div>
      </div>
    </article>`;
  },

  /* mobile off-canvas sidebar: inject a hamburger + overlay, wire toggling */
  initSidebar() {
    const nav = document.getElementById('sideNav');
    if (!nav || document.getElementById('navToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'navToggle';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.className = 'md:hidden fixed top-3 right-3 z-[60] bg-surface-container border border-outline-variant rounded p-2 text-primary-fixed-dim inner-glow';
    btn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
    const overlay = document.createElement('div');
    overlay.id = 'navOverlay';
    overlay.className = 'md:hidden fixed inset-0 bg-background/70 z-40 opacity-0 pointer-events-none transition-opacity duration-200';
    document.body.append(btn, overlay);
    const close = () => { nav.classList.add('-translate-x-full'); overlay.classList.add('opacity-0', 'pointer-events-none'); };
    const open = () => { nav.classList.remove('-translate-x-full'); overlay.classList.remove('opacity-0', 'pointer-events-none'); };
    btn.addEventListener('click', () => (nav.classList.contains('-translate-x-full') ? open() : close()));
    overlay.addEventListener('click', close);
    nav.addEventListener('click', (e) => { if (e.target.closest('a, button')) close(); });
  },
};

// auto-init the mobile sidebar wherever a #sideNav exists (no-op elsewhere)
if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') SN.initSidebar();
  else document.addEventListener('DOMContentLoaded', () => SN.initSidebar());
}
