/**
 * Contract pin: the first-login setup code (bootstrap secret, core#3221)
 * typed into UsernamePasswordForm MUST reach POST /auth/token as
 * provider_data.bootstrap_secret.
 *
 * The form is rendered by TWO consumers — LoginView and EnsureAdminSession
 * (the app-callback flow `/auth/login?callback-url=…`). The form passes the
 * code as a third onSubmit argument, and TypeScript happily accepts a
 * consumer handler that only declares two parameters — which is exactly how
 * the EnsureAdminSession flow shipped with a visible setup-code field that
 * silently never sent the value (fresh-node first login 401'd with the code
 * filled in). These tests drive the real consumer so that wiring can't
 * regress compile-clean again.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnsureAdminSession } from '../EnsureAdminSession';
import { UsernamePasswordForm } from '../UsernamePasswordForm';

const generateTokens = vi.fn(async (_payload: unknown) => ({
  data: { access_token: 'a.b.c', refresh_token: 'r.t' },
}));

vi.mock('../../../lib/mero', () => ({
  getMero: () => ({
    auth: {
      getProviders: async () => ({
        data: {
          providers: [{ name: 'user_password', type: 'credentials' }],
        },
      }),
      generateTokens: (payload: unknown) => generateTokens(payload),
    },
  }),
  hasLiveSession: async () => false,
  isAuthRevoked: () => false,
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

async function driveEnsureAdminSessionLogin(setupCode?: string) {
  render(
    <EnsureAdminSession>
      <div>children</div>
    </EnsureAdminSession>,
  );

  // Provider list → pick user_password to reach the credential form.
  const providerButton = await screen.findByText(/user_password/i);
  await userEvent.click(providerButton);

  await userEvent.type(await screen.findByPlaceholderText(/enter your username/i), 'admin');
  await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'calimero-pass');

  if (setupCode) {
    await userEvent.click(
      screen.getByRole('button', { name: /first login on a fresh node/i }),
    );
    await userEvent.type(screen.getByPlaceholderText(/startup log/i), setupCode);
  }

  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(generateTokens).toHaveBeenCalledTimes(1));
  return generateTokens.mock.calls[0][0] as {
    provider_data: Record<string, unknown>;
  };
}

beforeEach(() => {
  generateTokens.mockClear();
  sessionStorage.clear();
  localStorage.clear();
});

describe('first-login setup code wiring', () => {
  it('EnsureAdminSession sends the typed setup code as provider_data.bootstrap_secret', async () => {
    const payload = await driveEnsureAdminSessionLogin('a15392ac5904880da94199864f8294d2');
    expect(payload.provider_data).toMatchObject({
      username: 'admin',
      password: 'calimero-pass',
      bootstrap_secret: 'a15392ac5904880da94199864f8294d2',
    });
  });

  it('EnsureAdminSession omits bootstrap_secret entirely when no code is given', async () => {
    const payload = await driveEnsureAdminSessionLogin();
    expect(payload.provider_data).toMatchObject({
      username: 'admin',
      password: 'calimero-pass',
    });
    expect(payload.provider_data).not.toHaveProperty('bootstrap_secret');
  });

  it('EnsureAdminSession falls back to the setup-code URL param (desktop flow)', async () => {
    sessionStorage.setItem('setup-code', 'url-param-code-123');
    const payload = await driveEnsureAdminSessionLogin();
    expect(payload.provider_data).toMatchObject({
      bootstrap_secret: 'url-param-code-123',
    });
  });

  it('UsernamePasswordForm passes the setup code as the third onSubmit argument', async () => {
    const onSubmit = vi.fn();
    render(<UsernamePasswordForm onSubmit={onSubmit} onBack={() => {}} />);

    await userEvent.type(screen.getByPlaceholderText(/enter your username/i), 'admin');
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'calimero-pass');
    await userEvent.click(
      screen.getByRole('button', { name: /first login on a fresh node/i }),
    );
    await userEvent.type(screen.getByPlaceholderText(/startup log/i), 'code-42');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(onSubmit).toHaveBeenCalledWith('admin', 'calimero-pass', 'code-42');
  });
});
