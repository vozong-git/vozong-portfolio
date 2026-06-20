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
      // ── Semantic tokens → CSS variables (defined in src/styles/app.css).
      // Values are R G B channel triplets so Tailwind's /opacity modifier works
      // via rgb(var(--x) / <alpha-value>). Light/dark + the four accent presets
      // all live in the stylesheet; here we only wire the names. ──
      colors: Object.fromEntries([
        'primary', 'primary-fixed-dim', 'primary-fixed', 'surface-tint', 'inverse-primary',
        'primary-container', 'on-primary', 'on-primary-fixed', 'on-primary-fixed-variant', 'on-primary-container',
        'background', 'on-background', 'surface', 'surface-dim', 'surface-bright',
        'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high',
        'surface-container-highest', 'surface-variant', 'on-surface', 'on-surface-variant',
        'inverse-surface', 'inverse-on-surface', 'outline', 'outline-variant',
        'success', 'error', 'on-error', 'error-container', 'on-error-container',
        'secondary', 'secondary-container', 'on-secondary', 'on-secondary-container',
        'tertiary', 'tertiary-container', 'on-tertiary', 'on-tertiary-container',
        'secondary-fixed', 'secondary-fixed-dim', 'on-secondary-fixed', 'on-secondary-fixed-variant',
        'tertiary-fixed', 'tertiary-fixed-dim', 'on-tertiary-fixed', 'on-tertiary-fixed-variant',
      ].map((t) => [t, `rgb(var(--color-${t}) / <alpha-value>)`])),
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
