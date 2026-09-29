/**
 * The page must only talk to the node that served it. A crafted login link
 * naming another node (`app-url`) must stop at an error, before any request.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { server } from '../../vitest.setup';
import App from '../App';

const NODE = 'https://node.example';
const EVIL = 'https://evil.example';

const openLoginPage = (search: string) => {
  (window as any).location = {
    ...window.location,
    origin: NODE,
    href: `${NODE}/auth/login${search}`,
    search,
  };
};

describe('node URL guard', () => {
  const original = window.location;
  let requested: string[];
  const record = ({ request }: { request: Request }) => {
    requested.push(request.url);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // An admin session already stored on the node origin.
    localStorage.setItem('calimero_access_token', 'stored-access');
    localStorage.setItem('calimero_refresh_token', 'stored-refresh');
    requested = [];
    server.events.on('request:start', record);
  });

  afterEach(() => {
    server.events.removeListener('request:start', record);
    (window as any).location = original;
  });

  it('shows an error and sends nothing when app-url names another origin', async () => {
    openLoginPage(`?permissions=admin&app-url=${encodeURIComponent(EVIL)}`);

    render(<App />);

    expect((await screen.findByTestId('error-view')).textContent).toContain(EVIL);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requested).toEqual([]);
  });

  it('shows an error and sends nothing when auth-url names another origin', async () => {
    openLoginPage(`?permissions=admin&auth-url=${encodeURIComponent(EVIL)}`);

    render(<App />);

    expect((await screen.findByTestId('error-view')).textContent).toContain(EVIL);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requested).toEqual([]);
  });

  it('talks to the serving node when app-url is its own origin', async () => {
    openLoginPage(`?permissions=admin&app-url=${encodeURIComponent(NODE)}`);

    render(<App />);

    await vi.waitFor(() => expect(requested.length).toBeGreaterThan(0));
    for (const url of requested) {
      expect(new URL(url).origin).toBe(NODE);
    }
  });
});
