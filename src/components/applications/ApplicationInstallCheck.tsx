import { useState, useEffect } from 'react';
import { useContextCreation } from '../../hooks/useContextCreation';
import { getStoredUrlParam } from '../../utils/urlParams';
import { apiClient } from '@calimero-network/calimero-client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorView,
  Flex,
  Loader,
  Stack,
  Text,
} from '@calimero-network/mero-ui';

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
      <div style={{ 
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 520,
        width: '100%',
        padding: '0 16px',
      }}>
        <Card variant="rounded" color="var(--color-border-brand)">
          <CardContent>
            <ErrorView
              title="Installation Error"
              message={error}
              actionLabel="Back"
              onAction={onBack}
              showAction
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!applicationId || !applicationPath) {
    return (
      <div style={{ 
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 520,
        width: '100%',
        padding: '0 16px',
      }}>
        <Card variant="rounded" color="var(--color-border-brand)">
          <CardContent>
            <EmptyState
              title="Missing Application Information"
              description="Application ID and path are required to proceed."
              action={
                <Button variant="secondary" onClick={onBack}>
                  Back
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showInstallPrompt) {
    return (
      <div style={{ 
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 520,
        width: '100%',
        padding: '0 16px',
      }}>
        <Card variant="rounded" color="var(--color-border-brand)">
          <CardHeader>
            <CardTitle>Application ID Mismatch</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack spacing="lg" align="center">
              <Text align="center" color="muted">
                The application ID doesn't match the actual application. Would you like to install it anyway?
              </Text>
              <Flex justify="center" gap="sm">
                <Button 
                  variant="secondary"
                  onClick={handleInstallCancel}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary"
                  onClick={async () => {
                    const success = await checkAndInstallApplication(applicationId, applicationPath);
                    if (success) {
                      onComplete('', '');
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    color: 'var(--color-text-brand)',
                    borderColor: 'var(--color-border-brand)',
                  }}
                >
                  Install Anyway
                </Button>
              </Flex>
            </Stack>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 520,
      width: '100%',
      padding: '0 16px',
    }}>
      <Card variant="rounded" color="var(--color-border-brand)">
        <CardHeader>
          <CardTitle>Install Application</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack spacing="lg" align="center">
            <Text align="center" color="muted">
              This application needs to be installed to proceed. Would you like to install it now?
            </Text>
            <Flex justify="center" gap="sm">
              <Button 
                variant="secondary"
                onClick={onBack}
              >
                Cancel
              </Button>
              <Button 
                variant="primary"
                onClick={async () => {
                  const success = await checkAndInstallApplication(applicationId, applicationPath);
                  if (success) {
                    onComplete('', '');
                  }
                }}
                disabled={isLoading}
                style={{
                  color: 'var(--color-text-brand)',
                  borderColor: 'var(--color-border-brand)',
                }}
              >
                {isLoading ? 'Installing...' : 'Install Application'}
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </div>
  );
}
