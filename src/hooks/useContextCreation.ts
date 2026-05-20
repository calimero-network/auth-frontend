import { useState } from 'react';
import { getStoredUrlParam } from '../utils/urlParams';
import { getMero } from '../lib/mero';

/**
 * Hook backing `<ApplicationInstallCheck>`. Despite the historical name,
 * this hook **no longer creates contexts** — that responsibility moved
 * to the consuming app (see `AppMode` doc-comment in `types/flows.ts`).
 *
 * Surface kept here:
 *   - `checkAndInstallApplication()` — verify the app is installed on
 *     the node, install via `applicationPath` if a path is provided,
 *     handle the `blob hash mismatch` (dev-signed app reinstall) prompt.
 *   - `handleInstallCancel()` — dismiss the reinstall prompt.
 *   - `showInstallPrompt` / `error` / `isLoading` — UI state.
 *
 * The previous `handleContextCreation`, `selectedProtocol`,
 * `setSelectedProtocol`, and `PROTOCOLS` exports were removed —
 * they only served the deleted `ContextSelector` component.
 */

interface UseContextCreationReturn {
  isLoading: boolean;
  error: string | null;
  showInstallPrompt: boolean;
  checkAndInstallApplication: (
    applicationId?: string | null,
    applicationPath?: string | null
  ) => Promise<boolean>;
  handleInstallCancel: () => void;
}

function getStoredApplicationId(): string | null {
  return (
    getStoredUrlParam('application-id') ||
    sessionStorage.getItem('installed-application-id') ||
    localStorage.getItem('installed-application-id') || // Fallback for old sessions
    null
  );
}

export function useContextCreation(): UseContextCreationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const checkAndInstallApplication = async (
    applicationId?: string | null,
    applicationPath?: string | null
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const targetApplicationId = applicationId || getStoredApplicationId();

      if (!targetApplicationId) {
        throw new Error('Missing application identifier');
      }

      // No application path means the caller has already installed (or
      // doesn't have a wasm to install). Treat as success.
      if (!applicationPath) {
        return true;
      }

      const mero = getMero();

      try {
        await mero.admin.getApplication(targetApplicationId);
        // Application already installed — nothing to do.
        return true;
      } catch {
        // Not installed: try to install. The dev-signed-app reinstall
        // prompt is surfaced via `blob hash mismatch`.
        try {
          await mero.admin.installApplication({
            url: applicationPath,
            metadata: [],
          } as any);
          return true;
        } catch (installErr) {
          const errorMessage = installErr instanceof Error ? installErr.message : '';
          if (errorMessage === 'fatal: blob hash mismatch') {
            setShowInstallPrompt(true);
            return false;
          }
          throw installErr;
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to install application');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallCancel = () => {
    setShowInstallPrompt(false);
  };

  return {
    isLoading,
    error,
    showInstallPrompt,
    checkAndInstallApplication,
    handleInstallCancel,
  };
}
