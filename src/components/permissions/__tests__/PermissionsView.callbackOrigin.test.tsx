// The consent screen names the origin that receives the token and does not
// read the never-written `manifest-data` key.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PermissionsView } from '../PermissionsView';

const origin = () => screen.getByTestId('callback-origin').textContent;

const renderView = (mode = 'multi-context') =>
  render(
    <PermissionsView
      permissions={['context:execute']}
      selectedContext=""
      selectedIdentity=""
      mode={mode}
      onComplete={() => {}}
      onBack={() => {}}
    />,
  );

describe('PermissionsView callback origin', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubEnv('VITE_ALLOWED_CALLBACK_ORIGINS', 'https://example.org');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the origin the token will be sent to', async () => {
    sessionStorage.setItem('callback-url', 'https://example.org/app/cb?x=1');
    renderView();

    await waitFor(() => expect(origin()).toBe('Access token will be sent to: https://example.org'));
  });

  it('shows the origin on the admin consent screen too', async () => {
    sessionStorage.setItem('callback-url', 'https://example.org/cb');
    renderView('admin');

    await waitFor(() => expect(origin()).toContain('https://example.org'));
  });

  it('says so when no callback is given', async () => {
    renderView();

    await waitFor(() => expect(origin()).toMatch(/no token will be sent/i));
  });

  it('says so, and does not name the origin, when the callback is not allowed', async () => {
    sessionStorage.setItem('callback-url', 'https://evil.example/cb');
    renderView();

    await waitFor(() => {
      expect(origin()).toMatch(/no token will be sent/i);
      expect(origin()).not.toContain('evil.example');
    });
  });
});

describe('PermissionsView manifest-data', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not render anything from the never-written manifest-data key', () => {
    localStorage.setItem(
      'manifest-data',
      JSON.stringify({ name: 'Ghost Package', id: 'com.ghost', version: '9.9.9' }),
    );
    renderView();

    expect(screen.queryByText('Ghost Package')).toBeNull();
    expect(screen.queryByText(/com\.ghost/)).toBeNull();
  });
});
