import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local development configuration
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5002,
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
})
