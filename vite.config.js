import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script-defer',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'myWorkoutApp · FORM',
        short_name: 'FORM',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#172c36',
        background_color: '#172c36',
        icons: [
          { src: 'icons/form-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/form-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/form-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallback: 'index.html',
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH || '/',
  test: { include: ['tests/**/*.test.js'] },
})
