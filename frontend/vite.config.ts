import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // HU-033 (Bloque 5b): manifest + service worker para que la PWA abra sin
    // conexión después de la primera visita y se pueda instalar. Los íconos
    // salen del favicon.svg existente (autoUpdate: el service worker nuevo
    // se activa solo, sin pedirle nada al usuario).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SADIM',
        short_name: 'SADIM',
        description: 'PWA offline-first para micro-comercios y negocios de servicios.',
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // El shell de la app y las llamadas a /api/ se resuelven en el
        // código de la aplicación (cliente HTTP + cola de sincronización,
        // Bloque 5b); el service worker solo cachea el shell estático para
        // que la app ABRA sin conexión.
        navigateFallback: 'index.html',
        // B2 (F-10): las navegaciones a la API y al admin de Django van al
        // servidor, no al index.html de la PWA (si no, /admin/ mostraba la app).
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  server: {
    proxy: {
      // El backend de Django corre en localhost:8000 (python backend/manage.py
      // runserver). Al pasar por el proxy de Vite, el navegador ve el mismo
      // origen (localhost:5173) para /api/, así que el backend no necesita
      // configurar CORS.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
