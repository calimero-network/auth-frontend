// URL-supplied permissions must not grant admin in these flows, and the
// consent and summary screens must name the callback origin.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../components/manifest/ManifestProcessor', () => ({
  ManifestProcessor: ({ onComplete }: { onComplete: () => void }) => (
    <button
      onClick={() => {
        sessionStorage.setItem('installed-application-id', 'app-1');
        onComplete();
      }}
    >
      mock-install
    </button>
  ),
}));

vi.mock('../../components/applications/ApplicationInstallCheck', () => ({
  ApplicationInstallCheck: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>mock-app-check</button>
  ),
}));

import { PackageFlow } from '../PackageFlow';
import { ApplicationFlow } from '../ApplicationFlow';

const CALLBACK = 'https://example.org/app/cb';
const SENT_TO = 'Access token will be sent to: https://example.org';

const origin = () => screen.getByTestId('callback-origin').textContent;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv('VITE_ALLOWED_CALLBACK_ORIGINS', 'https://example.org');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PackageFlow', () => {
  const renderFlow = () => render(<PackageFlow mode="multi-context" packageName="com.example.app" />);

  it.each(['admin', 'Admin', ' ADMIN ', 'admin:x', 'admin[x]'])(
    'refuses a URL-supplied %j permission before installing anything',
    (spelling) => {
      sessionStorage.setItem('permissions', `context:execute,${spelling}`);
      sessionStorage.setItem('callback-url', CALLBACK);
      renderFlow();

      expect(screen.getByTestId('error-view').textContent).toMatch(/admin/i);
      expect(screen.queryByText('mock-install')).toBeNull();
      expect(screen.queryByText('Review Permissions')).toBeNull();
    },
  );

  it('names the callback origin on the permissions view and the summary', async () => {
    sessionStorage.setItem('permissions', 'context:execute');
    sessionStorage.setItem('callback-url', CALLBACK);
    renderFlow();

    await userEvent.click(screen.getByText('mock-install'));
    await waitFor(() => expect(origin()).toBe(SENT_TO));

    await userEvent.click(screen.getByRole('button', { name: 'Approve Permissions' }));
    expect(screen.getByText('Generate Token')).toBeTruthy();
    await waitFor(() => expect(origin()).toBe(SENT_TO));
  });

  it('says on the summary that nothing will be sent when the callback does not resolve', async () => {
    sessionStorage.setItem('permissions', 'context:execute');
    sessionStorage.setItem('callback-url', 'https://evil.example/cb');
    renderFlow();

    await userEvent.click(screen.getByText('mock-install'));
    await userEvent.click(screen.getByRole('button', { name: 'Approve Permissions' }));

    await waitFor(() => expect(origin()).toMatch(/no token will be sent/i));
  });
});

describe('ApplicationFlow', () => {
  const renderFlow = () =>
    render(<ApplicationFlow mode="multi-context" applicationId="app-1" applicationPath="/a.wasm" />);

  it.each(['admin', 'Admin', ' ADMIN ', 'admin:x', 'admin[x]'])(
    'refuses a URL-supplied %j permission',
    (spelling) => {
      sessionStorage.setItem('permissions', `context:execute,${spelling}`);
      sessionStorage.setItem('callback-url', CALLBACK);
      renderFlow();

      expect(screen.getByTestId('error-view').textContent).toMatch(/admin/i);
      expect(screen.queryByText('mock-app-check')).toBeNull();
    },
  );

  it('names the callback origin on the permissions view', async () => {
    sessionStorage.setItem('permissions', 'context:execute');
    sessionStorage.setItem('callback-url', CALLBACK);
    renderFlow();

    await userEvent.click(screen.getByText('mock-app-check'));
    await waitFor(() => expect(origin()).toBe(SENT_TO));
  });
});
