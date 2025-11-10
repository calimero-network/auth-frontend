import { useState } from 'react';
import { getStoredUrlParam } from '../utils/urlParams';
import { apiClient } from '@calimero-network/calimero-client';

export const PROTOCOLS = ['near', 'starknet', 'icp', 'stellar', 'ethereum'] as const;
export const PROTOCOL_DISPLAY = {
  near: 'NEAR',
  starknet: 'Starknet',
  icp: 'ICP',
  stellar: 'Stellar',
  ethereum: 'Ethereum'
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
    applicationIdOverride?: string | null
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

      const application = await apiClient
        .node()
        .getInstalledApplicationDetails(targetApplicationId);

      const applicationMissing =
        application.error || !application.data;

      if (applicationMissing) {
        const installResponse = await apiClient
          .node()
          .installApplication(applicationPath, new Uint8Array(), targetApplicationId);

        if (installResponse.error) {
          if(installResponse.error.message === 'fatal: blob hash mismatch') {
            setApplicationMismatch(true);
            setShowInstallPrompt(true);
            return false;
          }

          throw new Error(installResponse.error.message);
        }
        return true;
      }
      // Application exists
      return true;
    } catch (err) {
      throw err;
    }
  };

  const handleContextCreation = async (
    applicationIdOverride?: string | null
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const applicationPath = getStoredApplicationPath();
      let applicationId = applicationIdOverride || getStoredApplicationId();
      
      if (!applicationId || !selectedProtocol) {
        throw new Error('Missing required parameters');
      }

      // Install application when application path is available (legacy flow)
      if (applicationPath) {
        const installResponse = await apiClient
          .node()
          .installApplication(applicationPath, new Uint8Array());
        if (installResponse.error) {
          setError(installResponse.error.message);
          return;
        }
        const newApplicationId = installResponse.data.applicationId;
        applicationId = newApplicationId;
        sessionStorage.setItem('application-id', newApplicationId);
      }

      if (!applicationId) {
        throw new Error('Missing application identifier after installation');
      }

      // Create context using finalized application ID
      const createContextResponse = await apiClient
        .node()
        .createContext(applicationId, '{}', selectedProtocol);
      if (createContextResponse.error) {
        setError(createContextResponse.error.message);
        return;
      }

      // Handle successful context creation
      if (createContextResponse.data) {
        const { contextId, memberPublicKey } = createContextResponse.data;
        setSelectedProtocol(null);
        setShowInstallPrompt(false);
        setApplicationMismatch(false);
        return { contextId, memberPublicKey };
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