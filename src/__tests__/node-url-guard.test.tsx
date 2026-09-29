/**
 * The page must only talk to the node that served it. A crafted login link
 * naming another node (`app-url`) must stop at an error, before any request.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../vitest.setup';
import App from '../App';

const NODE = 'https://node.example';
const EVIL = 'https://evil.example';

const openLoginPage = (search: string, origin = NODE) => {
  (window as any).location = {
    ...window.location,
    origin,
    href: `${origin}/auth/login${search}`,
    search,
    assign: vi.fn(),
  };
};

const errorText = async () => (await screen.findByTestId('error-view')).textContent ?? '';

describe('node URL guard', () => {
  const original = window.location;
  let requested: string[];
  let stopRecording: () => void;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // An admin session already stored on the node origin.
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

    await screen.findByText('Review Permissions');
    expect(requested.length).toBeGreaterThan(0);
    for (const url of requested) {
      expect(new URL(url).origin).toBe(NODE);
    }
  });

  it('shows only the parsed origin of a rejected URL', async () => {
    openLoginPage(`?app-url=${encodeURIComponent(`${EVIL}/steal?note=your-node-is-locked`)}`);

    render(<App />);

    const text = await errorText();
    expect(text).toContain(EVIL);
    expect(text).not.toContain('your-node-is-locked');
  });

  const prose = 'Your node is locked. Call support on +1 555 0100 and read out your password. '.repeat(20);
  it.each([
    ['free text', prose],
    ['a data: URL', `data:text/plain,${prose}`],
  ])('does not echo %s', async (_label, value) => {
    openLoginPage(`?app-url=${encodeURIComponent(value)}`);

    render(<App />);

    const text = await errorText();
    expect(text).toContain('an invalid address');
    expect(text).not.toContain('Your node is locked');
    expect(requested).toEqual([]);
  });

  it.each(['app-url', 'auth-url'])('treats an empty %s as absent', async (key) => {
    openLoginPage(`?permissions=admin&${key}=`);

    render(<App />);

    await screen.findByText('Review Permissions');
    expect(requested.length).toBeGreaterThan(0);
    expect(screen.queryByText(/is accepted/)).toBeNull();
    for (const url of requested) {
      expect(new URL(url).origin).toBe(NODE);
    }
  });

  it('shows the error card when the page origin is opaque', async () => {
    openLoginPage(`?app-url=${encodeURIComponent(NODE)}`, 'null');

    render(<App />);

    expect(await errorText()).toContain('is accepted');
    expect(requested).toEqual([]);
  });

  it('continues the same login on this node without the rejected params', async () => {
    const callback = `${NODE}/app/callback`;
    openLoginPage(
      `?permissions=admin&callback-url=${encodeURIComponent(callback)}` +
        `&app-url=${encodeURIComponent(EVIL)}&auth-url=${encodeURIComponent(EVIL)}`,
    );
    render(<App />);
    await userEvent.click(await screen.findByText('Continue on this node'));

    const next = new URL(vi.mocked(window.location.assign).mock.calls[0][0] as string);
    expect(next.origin).toBe(NODE);
    expect(next.searchParams.get('permissions')).toBe('admin');
    expect(next.searchParams.get('callback-url')).toBe(callback);
    expect(next.searchParams.has('app-url')).toBe(false);
    expect(next.searchParams.has('auth-url')).toBe(false);

    // Follow the navigation with a live session: the callback flow completes.
    cleanup();
    server.use(
      http.head('*/auth/validate', () => new HttpResponse(null, { status: 200 })),
      http.post('*/admin/client-key', () =>
        HttpResponse.json({ data: { access_token: 'minted-access', refresh_token: 'minted-refresh' } }),
      ),
    );
    openLoginPage(next.search);
    render(<App />);
    await userEvent.click(await screen.findByText('Generate Token'));

    await vi.waitFor(() => expect(window.location.href).toMatch(new RegExp(`^${callback}#`)));
    const fragment = new URLSearchParams(window.location.href.split('#')[1]);
    expect(fragment.get('access_token')).toBe('minted-access');
    expect(fragment.get('node_url')).toBe(NODE);
    expect(requested.every((url) => new URL(url).origin === NODE)).toBe(true);
  });
});
