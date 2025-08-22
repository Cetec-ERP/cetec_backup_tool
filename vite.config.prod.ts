import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production configuration
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5002,
    proxy: {
      '/api': 'http://backups.cetecerpdevel.com:5001',
    },
  },
})
