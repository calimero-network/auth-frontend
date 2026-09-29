/**
 * The package flow's context picker must offer only the installed app's
 * contexts. A URL `application-id` is attacker-plantable next to
 * `package-name`, and used to steer the picker (and the minted token's
 * context binding) to another app's contexts — e.g. your password manager.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../hooks/useContextSelection', () => ({
  useContextSelection: () => ({
    contexts: [
      { id: 'ctx-evil-app', applicationId: 'app-evil' },
      { id: 'ctx-password-vault', applicationId: 'app-vault' },
    ],
    selectedContext: null,
    identities: [],
    selectedIdentity: null,
    loading: false,
    error: null,
    fetchContexts: vi.fn(),
    handleContextSelect: vi.fn(),
    handleIdentitySelect: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useContextCreation', () => ({
  PROTOCOL_DISPLAY: { near: 'NEAR' },
  useContextCreation: () => ({
    isLoading: false,
    error: null,
    checkAndInstallApplication: vi.fn(),
    setSelectedProtocol: vi.fn(),
    handleContextCreation: vi.fn(),
    handleInstallCancel: vi.fn(),
    showInstallPrompt: false,
  }),
}));

import { ContextSelector } from '../ContextSelector';

describe('ContextSelector application scoping', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // What a crafted package-flow link plants.
    sessionStorage.setItem('package-name', 'com.evil.x');
    sessionStorage.setItem('application-id', 'app-vault');
  });

  it('offers only the installed app when the flow passes its id', () => {
    render(<ContextSelector applicationId="app-evil" onComplete={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getAllByText('ctx-evil-app').length).toBeGreaterThan(0);
    expect(screen.queryByText('ctx-password-vault')).toBeNull();
  });

  it('still honours the URL application-id when no id is passed (application-id flow)', () => {
    sessionStorage.removeItem('package-name');
    render(<ContextSelector onComplete={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getAllByText('ctx-password-vault').length).toBeGreaterThan(0);
    expect(screen.queryByText('ctx-evil-app')).toBeNull();
  });
});
