import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * index.html carries the strict production CSP. The dev server injects CSS as inline <style>
 * tags and talks to the page over a websocket for HMR, so only there is the policy relaxed.
 */
function devContentSecurityPolicy(): Plugin {
  return {
    name: 'dev-content-security-policy',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("script-src 'self'", "script-src 'self'; connect-src 'self' ws://localhost:*");
    },
  };
}

export default defineConfig({
  // Relative paths so the built index.html also loads via file:// in Electron.
  base: './',
  plugins: [devContentSecurityPolicy()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
