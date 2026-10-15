import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

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
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Claude Code's git worktrees live in .claude/worktrees: not this code.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
