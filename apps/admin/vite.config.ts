import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The API proxy, shared by `vite dev` and `vite preview`.
 *
 * `preview` needs its own copy — it does not inherit `server.proxy` — and without it the
 * production build serves a site whose every request 404s. That matters beyond convenience:
 * Phase 8 runs Lighthouse against the built bundle, not the dev server, and a preview that
 * cannot reach the API would measure an empty page and call it fast.
 *
 * `127.0.0.1` rather than `localhost`: the API binds IPv4 only, while `localhost` can resolve
 * to `::1` first, and a proxy aimed at an address nothing listens on hangs rather than failing.
 */
const proxy = {
  '/api': { target: 'http://127.0.0.1:3002', changeOrigin: true },
  '/img': { target: 'http://127.0.0.1:3002', changeOrigin: true },
  '/uploads': { target: 'http://127.0.0.1:3002', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5183, proxy },
  preview: { port: 4183, proxy },
  build: {
    sourcemap: true,
    // Phase 8 enforces a 200 KB gzip budget per site; warn well before that.
    chunkSizeWarningLimit: 600,
  },
});
