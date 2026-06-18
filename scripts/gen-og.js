'use strict';
// Generate the social-share image (og:image / twitter:image).
//
//   node scripts/gen-og.js
//
// Renders a Studio Noir 1200x630 PNG to public/assets/og.png using resvg-js
// (a prebuilt rasterizer — no native compile). Run locally and commit the PNG;
// the server never rasterizes at runtime, so production needs neither resvg nor
// the fonts. Brand fonts are vendored under scripts/og-fonts/ for reproducibility.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const W = 1200;
const H = 630;
const FONT_DIR = path.join(__dirname, 'og-fonts');
const OUT = path.join(__dirname, '..', 'public', 'assets', 'og.png');

// Studio Noir palette (matches tailwind.config.js / theme tokens)
const C = {
  bgTop: '#0c0d0f',
  bgBottom: '#15161a',
  grid: '#23262b',
  accent: '#00daf3',
  accentDim: '#5fe6f6',
  onSurface: '#ECEEF0',
  variant: '#9aa0a6',
  outline: '#33373d',
};

// Deterministic equalizer waveform (the favicon's 4-bar motif, scaled up).
function waveform(x0, x1, baseY, maxH) {
  const n = 48;
  const gap = (x1 - x0) / n;
  const bw = gap * 0.46;
  let bars = '';
  for (let i = 0; i < n; i++) {
    // smooth pseudo-random envelope, symmetric-ish, peaks toward the middle
    const t = i / (n - 1);
    const env = Math.sin(Math.PI * t);
    const wobble = 0.45 + 0.55 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
    const h = Math.max(6, maxH * (0.18 + 0.82 * env * wobble));
    const x = x0 + i * gap + (gap - bw) / 2;
    const y = baseY - h;
    const op = (0.35 + 0.65 * env).toFixed(2);
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${(bw / 2).toFixed(1)}" fill="${C.accent}" opacity="${op}"/>`;
  }
  return bars;
}

// Faint console grid (vertical rules + a baseline)
function grid() {
  let g = '';
  for (let x = 90; x <= W - 90; x += 48) {
    g += `<line x1="${x}" y1="120" x2="${x}" y2="${H - 90}" stroke="${C.grid}" stroke-width="1" opacity="0.5"/>`;
  }
  return g;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${C.bgTop}"/>
      <stop offset="1" stop-color="${C.bgBottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.18" cy="0.32" r="0.9">
      <stop offset="0" stop-color="${C.accent}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g opacity="0.6">${grid()}</g>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- frame + left accent bar (inner-glow motif) -->
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="18" fill="none" stroke="${C.outline}" stroke-width="1.5"/>
  <rect x="20" y="20" width="8" height="${H - 40}" rx="4" fill="${C.accent}"/>

  <!-- kicker -->
  <text x="92" y="158" font-family="JetBrains Mono Medium" font-size="22" letter-spacing="6" fill="${C.accent}">SOUND ENGINEER · PORTFOLIO</text>

  <!-- title -->
  <text x="88" y="300" font-family="Hanken Grotesk" font-weight="700" font-size="128" fill="${C.onSurface}">Kim, Bojong</text>

  <!-- role -->
  <text x="92" y="366" font-family="Hanken Grotesk" font-weight="400" font-size="38" fill="${C.variant}">Senior Technical Director</text>
  <text x="92" y="416" font-family="JetBrains Mono Medium" font-size="26" letter-spacing="1" fill="${C.accentDim}">Mixing / Playback / Live Sound</text>

  <!-- hero waveform -->
  <g>${waveform(92, W - 92, H - 78, 116)}</g>
</svg>`;

const fontFiles = [
  path.join(FONT_DIR, 'hanken700.ttf'),
  path.join(FONT_DIR, 'hanken400.ttf'),
  path.join(FONT_DIR, 'jbmono500.ttf'),
];

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Hanken Grotesk' },
});
const png = resvg.render().asPng();
fs.writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${png.length} bytes, ${W}x${H})`);
