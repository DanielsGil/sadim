import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
