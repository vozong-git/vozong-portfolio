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
      colors: {
        'on-primary-fixed': '#001f24', 'primary-container': '#00e5ff', 'error': '#ffb4ab',
        'on-surface': '#e5e2e1', 'on-tertiary-fixed': '#251a00', 'surface-container-highest': '#353534',
        'outline-variant': '#3b494c', 'outline': '#849396', 'surface': '#131313',
        'tertiary-fixed': '#ffdf96', 'surface-tint': '#00daf3', 'secondary-container': '#feb300',
        'on-primary-fixed-variant': '#004f58', 'on-primary': '#00363d', 'surface-container-low': '#1c1b1b',
        'on-primary-container': '#00626e', 'primary-fixed-dim': '#00daf3', 'inverse-primary': '#006875',
        'tertiary-container': '#fec931', 'surface-container-high': '#2a2a2a', 'on-background': '#e5e2e1',
        'tertiary': '#ffeac0', 'on-secondary': '#432c00', 'primary': '#c3f5ff', 'surface-container': '#201f1f',
        'on-error': '#690005', 'on-error-container': '#ffdad6', 'surface-variant': '#353534',
        'surface-bright': '#393939', 'error-container': '#93000a', 'primary-fixed': '#9cf0ff',
        'secondary': '#ffd799', 'tertiary-fixed-dim': '#f3bf26', 'inverse-on-surface': '#313030',
        'on-secondary-container': '#6a4800', 'on-tertiary-fixed-variant': '#594400',
        'on-secondary-fixed-variant': '#604100', 'surface-container-lowest': '#0e0e0e',
        'on-tertiary-container': '#6f5500', 'surface-dim': '#131313', 'on-tertiary': '#3e2e00',
        'secondary-fixed': '#ffdeac', 'on-secondary-fixed': '#281900', 'on-surface-variant': '#bac9cc',
        'background': '#131313', 'secondary-fixed-dim': '#ffba38', 'inverse-surface': '#e5e2e1',
        'success': '#7ce0a0',
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
