import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextCreation } from '../useContextCreation';

// ── Mock the `lib/mero` module ───────────────────────────────────────────
const mockGetApplication = vi.fn();
const mockInstallApplication = vi.fn();

vi.mock('../../lib/mero', () => ({
  getMero: () => ({
    admin: {
      getApplication: (...args: unknown[]) => mockGetApplication(...args),
      installApplication: (...args: unknown[]) => mockInstallApplication(...args),
    },
  }),
}));

vi.mock('../../utils/urlParams', () => ({
  getStoredUrlParam: vi.fn((key: string) =>
    sessionStorage.getItem(key) || localStorage.getItem(key),
  ),
}));

describe('useContextCreation — slimmed install-check surface', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockGetApplication.mockReset();
    mockInstallApplication.mockReset();
  });

  it('returns the install-check shape only (no protocol / handleContextCreation)', () => {
    const { result } = renderHook(() => useContextCreation());
    expect(result.current).toMatchObject({
      isLoading: false,
      error: null,
      showInstallPrompt: false,
      checkAndInstallApplication: expect.any(Function),
      handleInstallCancel: expect.any(Function),
    });
    // Removed exports must not leak back in.
    expect((result.current as any).selectedProtocol).toBeUndefined();
    expect((result.current as any).setSelectedProtocol).toBeUndefined();
    expect((result.current as any).handleContextCreation).toBeUndefined();
  });

  it('throws when neither application id nor stored fallback is available', async () => {
    const { result } = renderHook(() => useContextCreation());
    await act(async () => {
      await expect(
        result.current.checkAndInstallApplication(null, '/path/to/app.wasm'),
      ).rejects.toThrow(/Missing application identifier/);
    });
    expect(result.current.error).toMatch(/Missing application identifier/);
  });

  it('returns true without contacting the node when no applicationPath is provided', async () => {
    sessionStorage.setItem('installed-application-id', 'app-stored');
    const { result } = renderHook(() => useContextCreation());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.checkAndInstallApplication(null, null);
    });
    expect(outcome).toBe(true);
    expect(mockGetApplication).not.toHaveBeenCalled();
    expect(mockInstallApplication).not.toHaveBeenCalled();
  });

  it('returns true when the application is already installed', async () => {
    mockGetApplication.mockResolvedValue({ applicationId: 'app-1' });
    const { result } = renderHook(() => useContextCreation());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.checkAndInstallApplication('app-1', '/p.wasm');
    });
    expect(outcome).toBe(true);
    expect(mockGetApplication).toHaveBeenCalledOnce();
    expect(mockInstallApplication).not.toHaveBeenCalled();
  });

  it('installs from applicationPath when getApplication 404s', async () => {
    mockGetApplication.mockRejectedValue(new Error('not found'));
    mockInstallApplication.mockResolvedValue({ applicationId: 'app-1' });
    const { result } = renderHook(() => useContextCreation());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.checkAndInstallApplication('app-1', '/p.wasm');
    });
    expect(outcome).toBe(true);
    expect(mockInstallApplication).toHaveBeenCalledWith({
      url: '/p.wasm',
      metadata: [],
    });
  });

  it('surfaces the dev-signed reinstall prompt on `blob hash mismatch`', async () => {
    mockGetApplication.mockRejectedValue(new Error('not found'));
    mockInstallApplication.mockRejectedValue(new Error('fatal: blob hash mismatch'));
    const { result } = renderHook(() => useContextCreation());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.checkAndInstallApplication('app-1', '/p.wasm');
    });
    expect(outcome).toBe(false);
    expect(result.current.showInstallPrompt).toBe(true);
  });

  it('rethrows non-hash-mismatch install errors after setting `error`', async () => {
    mockGetApplication.mockRejectedValue(new Error('not found'));
    mockInstallApplication.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useContextCreation());

    await act(async () => {
      await expect(
        result.current.checkAndInstallApplication('app-1', '/p.wasm'),
      ).rejects.toThrow(/disk full/);
    });
    expect(result.current.error).toMatch(/disk full/);
    expect(result.current.showInstallPrompt).toBe(false);
  });

  it('handleInstallCancel dismisses the prompt', async () => {
    mockGetApplication.mockRejectedValue(new Error('not found'));
    mockInstallApplication.mockRejectedValue(new Error('fatal: blob hash mismatch'));
    const { result } = renderHook(() => useContextCreation());

    await act(async () => {
      await result.current.checkAndInstallApplication('app-1', '/p.wasm');
    });
    expect(result.current.showInstallPrompt).toBe(true);

    act(() => result.current.handleInstallCancel());
    expect(result.current.showInstallPrompt).toBe(false);
  });

  it('falls back to stored application-id when explicit id is null', async () => {
    sessionStorage.setItem('installed-application-id', 'fallback-app');
    mockGetApplication.mockResolvedValue({ applicationId: 'fallback-app' });
    const { result } = renderHook(() => useContextCreation());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.checkAndInstallApplication(null, '/p.wasm');
    });
    expect(outcome).toBe(true);
    // Verify it actually queried with the fallback.
    expect(mockGetApplication).toHaveBeenCalledWith('fallback-app');
  });
});
