import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@/src': fileURLToPath(new URL('./src', import.meta.url)),
      '@/global': fileURLToPath(new URL('./src/global', import.meta.url)),
      '@/components': fileURLToPath(
        new URL('./src/components', import.meta.url),
      ),
      '@/assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@/templates': fileURLToPath(new URL('./src/templates', import.meta.url)),
      '@/layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
      '@/public': fileURLToPath(new URL('./public', import.meta.url)),
      react: fileURLToPath(
        new URL('../../node_modules/react', import.meta.url),
      ),
      'react-dom': fileURLToPath(
        new URL('../../node_modules/react-dom', import.meta.url),
      ),
      'react/jsx-runtime': fileURLToPath(
        new URL('../../node_modules/react/jsx-runtime.js', import.meta.url),
      ),
      'react/jsx-dev-runtime': fileURLToPath(
        new URL('../../node_modules/react/jsx-dev-runtime.js', import.meta.url),
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
