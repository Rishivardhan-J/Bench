import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The API runs separately (`npm run server`); in dev, Vite forwards /api (and the realtime socket) to it
// so the browser sees one origin and the session cookie just works.
const api = process.env.VITE_API_TARGET || 'http://127.0.0.1:8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: { '/api': { target: api, ws: true } },
  },
  preview: {
    proxy: { '/api': { target: api, ws: true } },
  },
})
