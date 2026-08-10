/**
 * The consent screen has to stay skimmable: a multi-context app asks for eight
 * scopes (mero-react's getPermissionsForMode), and rendering all eight as full
 * cards buried the Approve button under a wall of text. Detail now hides behind
 * a disclosure — except high-risk grants, which must never be collapsed.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionsView } from '../PermissionsView';

/** What mero-react's getPermissionsForMode(AppMode.MultiContext) sends. */
const MULTI_CONTEXT = [
  'context:create',
  'context:list',
  'context:execute',
  'application:list',
  'namespace',
  'group',
  'blob',
  'context:alias',
];

const renderView = (permissions: string[], mode: string) =>
  render(
    <PermissionsView
      permissions={permissions}
      selectedContext=""
      selectedIdentity=""
      mode={mode}
      onComplete={() => {}}
      onBack={() => {}}
    />,
  );

describe('PermissionsView disclosure', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('collapses the routine permissions behind a summary', async () => {
    renderView(MULTI_CONTEXT, 'multi-context');

    // The count is stated up front, but no per-permission detail is rendered.
    expect(screen.getByText('This application is requesting 8 permissions.')).toBeTruthy();
    expect(screen.getByText('8 standard permissions')).toBeTruthy();
    expect(screen.queryByText('Execute Smart Contracts')).toBeNull();
    expect(screen.queryByText('Groups & Members')).toBeNull();

    const toggle = screen.getByRole('button', { expanded: false });
    await userEvent.click(toggle);

    expect(screen.getByText('Execute Smart Contracts')).toBeTruthy();
    expect(screen.getByText('Groups & Members')).toBeTruthy();
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy();

    // ...and it collapses again.
    await userEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('Execute Smart Contracts')).toBeNull();
  });

  it('shows the approve/deny buttons without expanding anything', () => {
    renderView(MULTI_CONTEXT, 'multi-context');

    expect(screen.getByRole('button', { name: 'Approve Permissions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeTruthy();
  });

  it('never collapses a high-risk grant', () => {
    renderView(['admin'], 'admin');

    // Visible immediately — no disclosure to open.
    expect(screen.getByText('Full Node Administration')).toBeTruthy();
    expect(screen.getByText('Admin Access Requested')).toBeTruthy();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });

  it('keeps a high-risk grant visible while the rest stay collapsed', () => {
    renderView([...MULTI_CONTEXT, 'admin'], 'multi-context');

    expect(screen.getByText('Full Node Administration')).toBeTruthy();
    expect(screen.getByText('8 standard permissions')).toBeTruthy();
    expect(screen.queryByText('Execute Smart Contracts')).toBeNull();
  });

  it('renders a short request without a disclosure at all', () => {
    renderView(['context:execute'], 'single-context');

    expect(screen.getByText('Execute Smart Contracts')).toBeTruthy();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });

  it('labels scoped and family-wide variants of a known scope', async () => {
    renderView(['namespace:list[ns-1]', 'group:create', 'blob:read'], 'multi-context');

    await userEvent.click(screen.getByRole('button', { expanded: false }));

    // Bracket params and the `family:action` form both resolve to the copy for
    // the family instead of leaking the raw scope string.
    expect(screen.getByText('Namespaces')).toBeTruthy();
    expect(screen.getByText('Groups & Members')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.queryByText('namespace:list[ns-1]')).toBeNull();
  });
});
