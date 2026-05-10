import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ApplicationInstallCheck } from '../ApplicationInstallCheck';

// ── Mock dependencies ───────────────────────────────────────────────────
const mockGetApplication = vi.fn();
const mockGetLatestPackageVersion = vi.fn();

vi.mock('../../../lib/mero', () => ({
  getMero: () => ({
    admin: {
      getApplication: (...a: unknown[]) => mockGetApplication(...a),
      getLatestPackageVersion: (...a: unknown[]) => mockGetLatestPackageVersion(...a),
    },
  }),
}));

vi.mock('../../../utils/urlParams', () => ({
  getStoredUrlParam: vi.fn((key: string) =>
    sessionStorage.getItem(key) || localStorage.getItem(key),
  ),
}));

const mockCheckAndInstall = vi.fn();
const mockHandleCancel = vi.fn();
const stubHook = {
  isLoading: false,
  error: null as string | null,
  showInstallPrompt: false,
  checkAndInstallApplication: mockCheckAndInstall,
  handleInstallCancel: mockHandleCancel,
};
vi.mock('../../../hooks/useContextCreation', () => ({
  useContextCreation: () => stubHook,
}));

/**
 * These tests verify the *behavioural contract* the deprecation enforces:
 *   - onComplete is invoked with EMPTY contextId + EMPTY identity
 *     (no namespace / group / context selection happens here);
 *   - the install-check decisions go through the mero admin client.
 *
 * UI-text assertions are intentionally minimal — mero-ui rendering needs
 * a theme provider that isn't worth wiring for these unit tests.
 * `<ApplicationInstallCheck>` is also covered indirectly by the
 * Playwright e2e specs in `e2e/application-flow.spec.ts`.
 */
describe('<ApplicationInstallCheck /> — contract: no context/identity selection', () => {
  let onComplete: ReturnType<typeof vi.fn>;
  let onBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mockGetApplication.mockReset();
    mockGetLatestPackageVersion.mockReset();
    mockCheckAndInstall.mockReset();
    mockHandleCancel.mockReset();
    stubHook.isLoading = false;
    stubHook.error = null;
    stubHook.showInstallPrompt = false;
    onComplete = vi.fn();
    onBack = vi.fn();
  });

  it('app already installed by direct ID → onComplete("", "")', async () => {
    sessionStorage.setItem('application-id', 'app-direct-id');
    sessionStorage.setItem('application-path', 'http://example.com/a.wasm');
    mockGetApplication.mockResolvedValue({ applicationId: 'app-direct-id' });

    render(<ApplicationInstallCheck onComplete={onComplete} onBack={onBack} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith('', '');
    expect(localStorage.getItem('installed-application-id')).toBe('app-direct-id');
  });

  it('falls back to package-registry lookup → onComplete("", "")', async () => {
    sessionStorage.setItem('application-id', 'package-name-id');
    sessionStorage.setItem('application-path', 'http://example.com/a.wasm');
    mockGetApplication.mockRejectedValue(new Error('not found'));
    mockGetLatestPackageVersion.mockResolvedValue({ applicationId: 'resolved-uuid' });

    render(<ApplicationInstallCheck onComplete={onComplete} onBack={onBack} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith('', '');
    expect(localStorage.getItem('installed-application-id')).toBe('resolved-uuid');
  });

  it('does NOT call onComplete when neither lookup resolves', async () => {
    sessionStorage.setItem('application-id', 'unknown');
    sessionStorage.setItem('application-path', 'http://example.com/a.wasm');
    mockGetApplication.mockRejectedValue(new Error('not found'));
    mockGetLatestPackageVersion.mockRejectedValue(new Error('package not found'));

    render(<ApplicationInstallCheck onComplete={onComplete} onBack={onBack} />);

    // Both lookups need to settle before we can be sure onComplete won't fire.
    await waitFor(() => expect(mockGetLatestPackageVersion).toHaveBeenCalled());
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does NOT call onComplete when applicationId is absent', async () => {
    // No session/local storage set — the component should bail out.
    render(<ApplicationInstallCheck onComplete={onComplete} onBack={onBack} />);
    // Wait a tick — there's a useEffect path even with no applicationId.
    await new Promise((r) => setTimeout(r, 10));
    expect(onComplete).not.toHaveBeenCalled();
    expect(mockGetApplication).not.toHaveBeenCalled();
  });
});
