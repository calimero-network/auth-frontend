/**
 * Vitest setup file - initializes MSW for all tests
 */

import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers, resetScenario } from './src/mocks/handlers';

/**
 * Drop request-timeout signals in tests.
 *
 * This environment mixes jsdom's AbortController/AbortSignal with Node's fetch
 * (undici), whose Request brand-checks `init.signal` and rejects anything that
 * did not come from its own realm — including a signal round-tripped straight
 * back out of `new Request()`:
 *
 *   RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal
 *
 * Nothing constructible here passes that check, so any mero-js call (which
 * attaches a 10s timeout signal) dies as a "network error" before MSW ever sees
 * it. mero-js filters falsy signals out of combineSignals(), so returning
 * undefined simply runs the SDK's requests without a timeout — under test only.
 * Browsers and Tauri share one realm and are unaffected.
 */
AbortSignal.timeout = (() => undefined) as unknown as typeof AbortSignal.timeout;

// Create MSW server with handlers
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  console.log('🎭 MSW Server started for tests');
});

// Reset handlers and scenario after each test
afterEach(() => {
  server.resetHandlers();
  resetScenario();
});

// Clean up after all tests
afterAll(() => {
  server.close();
  console.log('🎭 MSW Server closed');
});

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Mock window.location for URL manipulation in tests
beforeAll(() => {
  delete (window as any).location;
  (window as any).location = {
    search: '',
    pathname: '/auth/login',
    hash: '',
    href: 'http://localhost:5173/auth/login',
    origin: 'http://localhost:5173',
    toString: () => 'http://localhost:5173/auth/login',
  };
});


