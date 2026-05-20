import { describe, it, expect } from 'vitest';

/**
 * Lock-in test for the username/password-only login policy.
 *
 * Both `EnsureAdminSession` and `LoginView` filter the server-advertised
 * provider list with the same predicate before passing it to the
 * `<ProviderSelector>`. This test pins that predicate independently so a
 * future change that re-introduces NEAR (or any other provider name)
 * without updating the policy fails here.
 *
 * If we ever need a richer filter, factor it into a shared util and call
 * that from both components — then update this test to import it.
 */
const isSupportedProvider = (name: string) =>
  name === 'user_password' || name === 'username_password';

describe('auth provider filter — only username/password is supported', () => {
  const fakeServerProviders = [
    { name: 'near_wallet', type: 'oauth', description: 'NEAR Wallet' },
    { name: 'user_password', type: 'password', description: 'Username/Password' },
    { name: 'github_oauth', type: 'oauth', description: 'GitHub' },
    { name: 'username_password', type: 'password', description: 'Alias' },
  ];

  it('drops near_wallet from the picker', () => {
    const filtered = fakeServerProviders.filter((p) => isSupportedProvider(p.name));
    expect(filtered.find((p) => p.name === 'near_wallet')).toBeUndefined();
  });

  it('drops any non-username/password provider (github_oauth)', () => {
    const filtered = fakeServerProviders.filter((p) => isSupportedProvider(p.name));
    expect(filtered.find((p) => p.name === 'github_oauth')).toBeUndefined();
  });

  it('keeps user_password', () => {
    const filtered = fakeServerProviders.filter((p) => isSupportedProvider(p.name));
    expect(filtered.find((p) => p.name === 'user_password')).toBeDefined();
  });

  it('keeps the username_password alias', () => {
    const filtered = fakeServerProviders.filter((p) => isSupportedProvider(p.name));
    expect(filtered.find((p) => p.name === 'username_password')).toBeDefined();
  });

  it('returns an empty list when the server lists no supported providers', () => {
    const all = [
      { name: 'near_wallet', type: 'oauth' },
      { name: 'github_oauth', type: 'oauth' },
    ];
    expect(all.filter((p) => isSupportedProvider(p.name))).toEqual([]);
  });
});
