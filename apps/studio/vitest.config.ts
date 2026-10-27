import { defineConfig } from 'vitest/config';

/**
 * Studio unit tests — the Presentation resolvers, the „Otwórz w podglądzie"
 * contract, pagination and the tool menu. `locations.test.ts` imports the
 * whole schema registry, so `.tsx` schema components must transform.
 */
export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    include: ['presentation/**/*.test.ts'],
    css: false,
  },
});
