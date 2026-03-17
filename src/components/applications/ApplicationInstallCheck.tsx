import { useState, useEffect } from 'react';
import { useContextCreation } from '../../hooks/useContextCreation';
import { getStoredUrlParam } from '../../utils/urlParams';
import { getMero } from '../../lib/mero';
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
import { PageShell } from '../common/PageShell';

interface ApplicationInstallCheckProps {
  onComplete: (contextId: string, identity: string) => void;
  onBack: () => void;
}

const PRIMARY_BTN = {
  backgroundColor: '#A5FF11',
  color: '#0A0E13',
  border: 'none',
} as const;

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
        const mero = getMero();

        // getApplication() expects the installed UUID, not the package ID.
        // Use getLatestVersion(packageId) which resolves package → installed UUID.
        const latestResponse = await mero.admin.applications.getLatestVersion(applicationId);
        const installedId = (latestResponse as any)?.applicationId;
        if (installedId) {
          // Store so downstream token generation can scope permissions to this app
          localStorage.setItem('installed-application-id', installedId);
          onComplete('', '');
          return;
        }
        // No installed version found — fall through to show install UI
        setIsCheckingInstallation(false);
      } catch (err) {
        // Application not installed or error — show installation prompt
        console.error('Application not installed:', err);
        setIsCheckingInstallation(false);
      }
    };

    checkApplication();
  }, [applicationId, applicationPath, onComplete]);

  if (isLoading || isCheckingInstallation) {
    return <Loader />;
  }

  if (error) {
    return (
      <PageShell>
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
      </PageShell>
    );
  }

  if (!applicationId || !applicationPath) {
    return (
      <PageShell>
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
      </PageShell>
    );
  }

  if (showInstallPrompt) {
    return (
      <PageShell>
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
                  style={PRIMARY_BTN}
                >
                  Install Anyway
                </Button>
              </Flex>
            </Stack>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
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
                style={PRIMARY_BTN}
              >
                {isLoading ? 'Installing...' : 'Install & Continue'}
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </PageShell>
  );
}
