import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from '@/src/test/msw/server';

// `server-only` throws at import time to prevent Server-only modules from
// being bundled into Client Components. Vitest runs in a jsdom-like
// environment that trips that guard, so we stub it out globally.
vi.mock('server-only', () => ({}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
