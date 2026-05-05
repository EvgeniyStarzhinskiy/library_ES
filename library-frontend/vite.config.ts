import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/library_ES/',   // ← добавили базовый путь
  server: {
    allowedHosts: ['jhonstar.ru', 'www.jhonstar.ru'],
    port: 5173
  }
})