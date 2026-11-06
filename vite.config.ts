import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'TermiRecord - Terminal Session Player & SVG Animator',
        short_name: 'TermiRecord',
        description: 'Lightweight local-first player and generator that renders terminal recordings into animated SVGs',
        theme_color: '#090d16',
        background_color: '#090d16',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,cast}'],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
