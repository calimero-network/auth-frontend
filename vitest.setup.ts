/**
 * Vitest setup file - initializes MSW for all tests
 */

import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers, resetScenario } from './src/mocks/handlers';

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

