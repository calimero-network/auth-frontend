import { useState } from 'react';
import { getStoredUrlParam } from '../utils/urlParams';
import { getMero } from '../lib/mero';
import { describeError } from '../utils/errors';

export const PROTOCOLS = ['near'] as const;
export const PROTOCOL_DISPLAY = {
  near: 'NEAR',
} as const;

export type Protocol = typeof PROTOCOLS[number];

interface UseContextCreationReturn {
  isLoading: boolean;
  error: string | null;
  showInstallPrompt: boolean;
  selectedProtocol: Protocol | null;
  setSelectedProtocol: (protocol: Protocol | null) => void;
  checkAndInstallApplication: (
    applicationId?: string | null,
    coords?: { package: string; version: string } | null
  ) => Promise<boolean>;
  handleContextCreation: (
    applicationIdOverride?: string | null,
    initArgs?: string | null
  ) => Promise<{ contextId: string; memberPublicKey: string } | undefined>;
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

/**
 * The registry coordinates to install from.
 *
 * ⚠️ NOT a URL. Since core#3652 ("registry-only application distribution",
 * first released in 0.11.0-rc.31) a node installs an application by
 * `package@version` and resolves the artifact against its OWN configured
 * registry. `POST /admin-api/install-application` takes exactly
 * `{ package, version }` and refuses any other field outright:
 *
 *   unknown field `url`, expected `package` or `version`
 *
 * which is what every install through this screen answered with. The
 * `application-path` parameter this used to read is that dead contract — a URL
 * the node will not accept and cannot be given.
 */
function getStoredPackageCoords(): { package: string; version: string } | null {
  const name = getStoredUrlParam('package-name');
  const version = getStoredUrlParam('package-version');
  if (!name || !version) return null;
  return { package: name, version };
}

/**
 * The group a new context belongs to.
 *
 * ⚠️ `createContext` REQUIRES a `groupId` now, and no longer takes a
 * `protocol` — a context is not free-standing any more, it lives inside a
 * group. A namespace's id is usable directly as that group id (verified
 * against a 0.11.0-rc.32 node: `POST /admin-api/contexts` with
 * `groupId = namespaceId` creates the context and answers with that same id in
 * `groupId`), so this reuses the application's existing namespace and only
 * creates one when the node has none.
 */
async function resolveGroupId(applicationId: string): Promise<string> {
  const mero = getMero();

  // `ListNamespacesResponseData` is the array itself, not an object wrapping
  // one — the same shape trap the alias listings have.
  const existing = await mero.admin
    .listNamespacesForApplication(applicationId)
    .catch(() => null);
  const first = existing?.[0]?.namespaceId;
  if (first) return first;

  const created = await mero.admin.createNamespace({ applicationId });
  return created.namespaceId;
}

export function useContextCreation(): UseContextCreationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [applicationMismatch, setApplicationMismatch] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);

  const checkAndInstallApplication = async (
    applicationId?: string | null,
    coords?: { package: string; version: string } | null
  ) => {
    try {
      const targetApplicationId = applicationId || getStoredApplicationId();

      if (!targetApplicationId) {
        throw new Error('Missing application identifier');
      }

      // No coordinates to install from: assume the app is already installed,
      // which is the same assumption the old path-less branch made.
      const target = coords ?? getStoredPackageCoords();
      if (!target) {
        return true;
      }

      const mero = getMero();
      
      try {
        await mero.admin.getApplication(targetApplicationId);
        // Application exists
        return true;
      } catch {
        // Application doesn't exist, try to install
        try {
          await mero.admin.installApplication(target);
          return true;
        } catch (installErr) {
          // ⚠️ `includes`, NOT `===`. The node's sentence now arrives with the
          // status in front of it (`HTTP 400: fatal: blob hash mismatch`), and
          // an equality check against the bare string silently stops matching
          // — which turns the "reinstall this application?" prompt back into a
          // dead-end error card.
          const errorMessage = describeError(installErr, '');
          if (errorMessage.includes('blob hash mismatch')) {
            setApplicationMismatch(true);
            setShowInstallPrompt(true);
            return false;
          }
          throw installErr;
        }
      }
    } catch (err) {
      throw err;
    }
  };

  const handleContextCreation = async (
    applicationIdOverride?: string | null,
    initArgs?: string | null
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const mero = getMero();
      const coords = getStoredPackageCoords();
      let applicationId = applicationIdOverride || getStoredApplicationId();

      if (!applicationId || !selectedProtocol) {
        throw new Error('Missing required parameters');
      }

      // Install first when we were given coordinates to install from.
      if (coords) {
        try {
          const installResponse = await mero.admin.installApplication(coords);
          applicationId = installResponse.applicationId;
          sessionStorage.setItem('application-id', applicationId);
        } catch (installErr) {
          setError(describeError(installErr, 'Failed to install application'));
          return;
        }
      }

      if (!applicationId) {
        throw new Error('Missing application identifier after installation');
      }

      // Create context using finalized application ID
      try {
        const createContextResponse = await mero.admin.createContext({
          applicationId,
          groupId: await resolveGroupId(applicationId),
          initializationParams: initArgs
            ? Array.from(new TextEncoder().encode(initArgs))
            : [],
        });

        const { contextId, memberPublicKey } = createContextResponse;
        setSelectedProtocol(null);
        setShowInstallPrompt(false);
        setApplicationMismatch(false);
        return { contextId, memberPublicKey };
      } catch (createErr) {
        setError(describeError(createErr, 'Failed to create context'));
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to install application');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallCancel = () => {
    setShowInstallPrompt(false);
    setApplicationMismatch(false);
  };

  return {
    isLoading,
    error,
    showInstallPrompt,
    selectedProtocol,
    setSelectedProtocol,
    checkAndInstallApplication,
    handleContextCreation,
    handleInstallCancel
  };
} 