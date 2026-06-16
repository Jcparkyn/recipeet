import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Recipeet',
        short_name: 'Recipeet',
        description: 'Interactive step-by-step recipe cookbook',
        theme_color: '#2d6a4f',
        background_color: '#fdfaf3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.deepseek\.com\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'llm-cache', expiration: { maxEntries: 20 } },
          },
          {
            urlPattern: /^https:\/\/r\.jina\.ai\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'jina-cache', expiration: { maxEntries: 50 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
