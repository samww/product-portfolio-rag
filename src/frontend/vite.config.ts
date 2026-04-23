import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../api/static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/query': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/summarise': 'http://localhost:8000',
      '/embeddings/project': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
