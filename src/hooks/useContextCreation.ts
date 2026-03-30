import { useState } from 'react';
import { getStoredUrlParam } from '../utils/urlParams';
import { getMero } from '../lib/mero';

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
    applicationPath?: string | null
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

function getStoredApplicationPath(): string | null {
  return getStoredUrlParam('application-path');
}

export function useContextCreation(): UseContextCreationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [applicationMismatch, setApplicationMismatch] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);

  const checkAndInstallApplication = async (
    applicationId?: string | null,
    applicationPath?: string | null
  ) => {
    try {
      const targetApplicationId = applicationId || getStoredApplicationId();

      if (!targetApplicationId) {
        throw new Error('Missing application identifier');
      }

      // If we don't have an application path, assume app is already installed
      if (!applicationPath) {
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
          await mero.admin.installApplication({
            url: applicationPath,
            metadata: [],
          } as any);
          return true;
        } catch (installErr) {
          const errorMessage = installErr instanceof Error ? installErr.message : '';
          if (errorMessage === 'fatal: blob hash mismatch') {
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
      const applicationPath = getStoredApplicationPath();
      let applicationId = applicationIdOverride || getStoredApplicationId();
      
      if (!applicationId || !selectedProtocol) {
        throw new Error('Missing required parameters');
      }

      // Install application when application path is available (legacy flow)
      if (applicationPath) {
        try {
          const installResponse = await mero.admin.installApplication({
            url: applicationPath,
            metadata: [],
          } as any);
          const newApplicationId = (installResponse as any)?.data?.applicationId ?? (installResponse as any)?.applicationId;
          applicationId = newApplicationId;
          sessionStorage.setItem('application-id', newApplicationId);
        } catch (installErr) {
          setError(installErr instanceof Error ? installErr.message : 'Failed to install application');
          return;
        }
      }

      if (!applicationId) {
        throw new Error('Missing application identifier after installation');
      }

      // Create context using finalized application ID
      try {
        const createContextResponse = await mero.admin.createContext({
          protocol: selectedProtocol,
          applicationId,
          initializationParams: initArgs
            ? Array.from(new TextEncoder().encode(initArgs))
            : [],
        } as any);

        const respData = (createContextResponse as any)?.data ?? createContextResponse;
        const { contextId, memberPublicKey } = respData;
        setSelectedProtocol(null);
        setShowInstallPrompt(false);
        setApplicationMismatch(false);
        return { contextId, memberPublicKey };
      } catch (createErr) {
        setError(createErr instanceof Error ? createErr.message : 'Failed to create context');
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