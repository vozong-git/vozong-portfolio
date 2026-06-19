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
      // ── Light theme (clean white / black / gray, tamed cyan accent) ──
      colors: {
        // accent
        'primary': '#0e7490', 'primary-fixed-dim': '#0e7490', 'primary-fixed': '#0b5f76',
        'surface-tint': '#0e7490', 'inverse-primary': '#7cd0e6',
        'primary-container': '#cdeef6', 'on-primary': '#ffffff', 'on-primary-fixed': '#ffffff',
        'on-primary-fixed-variant': '#0b5566', 'on-primary-container': '#0b5566',
        // page + surfaces
        'background': '#ffffff', 'on-background': '#1a1c1e',
        'surface': '#ffffff', 'surface-dim': '#eef1f3', 'surface-bright': '#ffffff',
        'surface-container-lowest': '#f8f9fa', 'surface-container-low': '#f4f6f7',
        'surface-container': '#f4f6f7', 'surface-container-high': '#eceef0',
        'surface-container-highest': '#e5e8ea', 'surface-variant': '#eceef0',
        'on-surface': '#1a1c1e', 'on-surface-variant': '#5a6063',
        'inverse-surface': '#2b2e30', 'inverse-on-surface': '#f1f3f4',
        // outlines
        'outline': '#8b9296', 'outline-variant': '#dfe3e6',
        // status
        'success': '#1a7f43', 'error': '#b3261e', 'on-error': '#ffffff',
        'error-container': '#f9dedc', 'on-error-container': '#410e0b',
        // category accents (legible on white)
        'secondary': '#b5651d', 'secondary-container': '#b5651d', 'on-secondary': '#ffffff',
        'on-secondary-container': '#4a2a0a',
        'tertiary': '#8a6d00', 'tertiary-container': '#8a6d00', 'on-tertiary': '#ffffff',
        'on-tertiary-container': '#3a2e00',
        // rarely-used fixed/dim tokens
        'secondary-fixed': '#f3e2cf', 'secondary-fixed-dim': '#e0c19a',
        'on-secondary-fixed': '#2a1900', 'on-secondary-fixed-variant': '#604100',
        'tertiary-fixed': '#f3e6b8', 'tertiary-fixed-dim': '#d8c06a',
        'on-tertiary-fixed': '#3a2e00', 'on-tertiary-fixed-variant': '#594400',
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
