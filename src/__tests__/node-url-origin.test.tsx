/**
 * With an admin session stored, a login link naming another node must not make
 * the page send anything off the origin that served it.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { server } from '../../vitest.setup';
import App from '../App';

const NODE = 'https://node.example';

const openLoginPage = (search: string) => {
  (window as any).location = {
    ...window.location,
    origin: NODE,
    hostname: new URL(NODE).hostname,
    href: `${NODE}/auth/login${search}`,
    search,
    assign: vi.fn(),
  };
};

describe('node URL origin', () => {
  const original = window.location;
  let requested: string[];
  let stopRecording: () => void;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('calimero_access_token', 'stored-access');
    localStorage.setItem('calimero_refresh_token', 'stored-refresh');
    const mine: string[] = [];
    const record = ({ request }: { request: Request }) => {
      mine.push(request.url);
    };
    requested = mine;
    server.events.on('request:start', record);
    stopRecording = () => server.events.removeListener('request:start', record);
  });

  afterEach(() => {
    stopRecording();
    (window as any).location = original;
  });

  const cases = [
    ['app-url', 'https://other.example'],
    ['app-url', 'http://127.0.0.1:9999'],
    ['auth-url', 'https://other.example'],
  ];
  for (const [key, target] of cases) {
    it(`sends nothing off the node origin for ${key}=${target}`, async () => {
      openLoginPage(`?permissions=admin&${key}=${encodeURIComponent(target)}`);
      render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(requested.filter((url) => new URL(url).origin !== NODE)).toEqual([]);
    });
  }
});
