import { useState, useEffect } from 'react';
import { useContextCreation } from '../../hooks/useContextCreation';
import { EmptyState } from '../common/styles';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';
import { getStoredUrlParam } from '../../utils/urlParams';
import { apiClient } from '@calimero-network/calimero-client';

interface ApplicationInstallCheckProps {
  onComplete: (contextId: string, identity: string) => void;
  onBack: () => void;
}

export function ApplicationInstallCheck({ onComplete, onBack }: ApplicationInstallCheckProps) {
  const {
    isLoading,
    error,
    checkAndInstallApplication,
    handleInstallCancel,
    showInstallPrompt,
  } = useContextCreation();

  const [isCheckingInstallation, setIsCheckingInstallation] = useState(true);

  const applicationId = getStoredUrlParam('application-id');
  const applicationPath = getStoredUrlParam('application-path');

  useEffect(() => {
    const checkApplication = async () => {
      if (!applicationId || !applicationPath) {
        setIsCheckingInstallation(false);
        return;
      }

      try {
        // Check if the application is already installed
        const response = await apiClient.node().getInstalledApplicationDetails(applicationId);
        if (!response.error && response.data) {
          // Application exists, proceed to permissions
          onComplete('', '');
          return;
        }
        
        // Application doesn't exist, show installation prompt
        setIsCheckingInstallation(false);
      } catch (err) {
        console.error('Failed to check application:', err);
        setIsCheckingInstallation(false);
      }
    };

    checkApplication();
  }, [applicationId, onComplete]);

  if (isLoading || isCheckingInstallation) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorView 
        message={error} 
        onRetry={onBack}
      />
    );
  }

  if (!applicationId || !applicationPath) {
    return (
      <EmptyState>
        <h2>Missing Application Information</h2>
        <p>Application ID and path are required to proceed.</p>
        <Button onClick={onBack}>Back</Button>
      </EmptyState>
    );
  }

  if (showInstallPrompt) {
    return (
      <EmptyState>
        <h2>Application ID Mismatch</h2>
        <p>The application ID doesn't match the actual application. Would you like to install it anyway?</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button 
            onClick={handleInstallCancel}
            style={{ marginRight: '10px' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              const success = await checkAndInstallApplication(applicationId, applicationPath);
              if (success) {
                onComplete('', '');
              }
            }}
            disabled={isLoading}
            primary
          >
            Install Anyway
          </Button>
        </div>
      </EmptyState>
    );
  }

  return (
    <EmptyState>
      <h2>Install Application</h2>
      <p>This application needs to be installed to proceed. Would you like to install it now?</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <Button 
          onClick={onBack}
          style={{ marginRight: '10px' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={async () => {
            const success = await checkAndInstallApplication(applicationId, applicationPath);
            if (success) {
              onComplete('', '');
            }
          }}
          disabled={isLoading}
          primary
        >
          {isLoading ? 'Installing...' : 'Install Application'}
        </Button>
      </div>
    </EmptyState>
  );
} 