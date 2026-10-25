import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// Where the dev server sends /api and /ws: the backend, or with BACKEND_URL
// something in front of it, such as the Kubernetes Ingress
// (BACKEND_URL=http://localhost npm run dev).
const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
      },
      // STOMP over a plain WebSocket. The Origin header stays the dev
      // server's, which the backend allows.
      '/ws': {
        target: backend.replace(/^http/, 'ws'),
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Claude Code's git worktrees live in .claude/worktrees: not this code.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Every file sets up its own jsdom, all in parallel, so on a busy machine
    // tests that click and type can take longer than the default 5 seconds.
    testTimeout: 15000,
  },
})
