/* Studio Noir — Tailwind build config.
   Migrated from the former public/assets/theme.js (Play-CDN inline config).
   Build:  npm run build:css   →   public/assets/app.css */
'use strict';

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./public/**/*.html', './public/assets/*.js'],
  theme: {
    extend: {
      // ── Warm light theme (Claude-style cream + coral accent) ──
      colors: {
        // accent — Claude coral / terracotta
        'primary': '#C15F3C', 'primary-fixed-dim': '#C15F3C', 'primary-fixed': '#A84E2E',
        'surface-tint': '#C15F3C', 'inverse-primary': '#E8A88E',
        'primary-container': '#F2E1D8', 'on-primary': '#ffffff', 'on-primary-fixed': '#ffffff',
        'on-primary-fixed-variant': '#8A3D22', 'on-primary-container': '#8A3D22',
        // page + warm (cream) surfaces — never pure white in large areas
        'background': '#FAF9F5', 'on-background': '#2A2824',
        'surface': '#ffffff', 'surface-dim': '#F0EEE8', 'surface-bright': '#ffffff',
        'surface-container-lowest': '#F4F2EB', 'surface-container-low': '#FAF8F3',
        'surface-container': '#FCFBF8', 'surface-container-high': '#F1EFE8',
        'surface-container-highest': '#E9E6DD', 'surface-variant': '#EFEDE5',
        'on-surface': '#2A2824', 'on-surface-variant': '#6B6862',
        'inverse-surface': '#2A2824', 'inverse-on-surface': '#FAF9F5',
        // outlines (warm)
        'outline': '#9C988D', 'outline-variant': '#E6E2D8',
        // status
        'success': '#2F7D4F', 'error': '#B3261E', 'on-error': '#ffffff',
        'error-container': '#F7DEDA', 'on-error-container': '#410E0B',
        // categories + tags → neutral warm grey, so coral stays the only accent
        'secondary': '#6B6862', 'secondary-container': '#6B6862', 'on-secondary': '#ffffff',
        'on-secondary-container': '#2A2824',
        'tertiary': '#6B6862', 'tertiary-container': '#6B6862', 'on-tertiary': '#ffffff',
        'on-tertiary-container': '#2A2824',
        // rarely-used fixed/dim tokens → warm neutrals
        'secondary-fixed': '#EFEAE0', 'secondary-fixed-dim': '#D9D2C4',
        'on-secondary-fixed': '#2A2824', 'on-secondary-fixed-variant': '#5A564E',
        'tertiary-fixed': '#EFEAE0', 'tertiary-fixed-dim': '#D9D2C4',
        'on-tertiary-fixed': '#2A2824', 'on-tertiary-fixed-variant': '#5A564E',
      },
      borderRadius: { DEFAULT: '0.125rem', lg: '0.25rem', xl: '0.5rem', full: '0.75rem' },
      spacing: {
        'stack-sm': '8px', 'stack-lg': '48px', 'margin-mobile': '16px', 'unit': '4px',
        'container-max': '1280px', 'gutter': '24px', 'stack-md': '24px',
      },
      fontFamily: {
        'metadata-sm': ['JetBrains Mono'], 'display-lg': ['Hanken Grotesk'], 'label-caps': ['JetBrains Mono'],
        'headline-lg': ['Hanken Grotesk'], 'body-md': ['Inter'], 'headline-lg-mobile': ['Hanken Grotesk'],
      },
      fontSize: {
        'metadata-sm': ['13px', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '500' }],
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'label-caps': ['11px', { lineHeight: '1.0', letterSpacing: '0.1em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'headline-lg-mobile': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
