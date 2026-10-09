import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // STOMP over a plain WebSocket. The Origin header stays the dev
      // server's, which the backend allows.
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})
