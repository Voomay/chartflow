import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  cacheDir: 'd:/fx/.vite-cache',
  server: {
    port: 3005,
    strictPort: true,
    host: true
  },
  preview: {
    port: 3005,
    strictPort: true,
    host: true
  }
})
