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
  // ⚠️ Coordinates, not a URL. A node installs by `package@version` and
  // resolves the artifact against its own registry (core#3652, rc.31+); the
  // `application-path` this used to read is a contract the node deleted.
  const packageName = getStoredUrlParam('package-name');
  const packageVersion = getStoredUrlParam('package-version');
  const coords =
    packageName && packageVersion
      ? { package: packageName, version: packageVersion }
      : null;

  useEffect(() => {
    const checkApplication = async () => {
      if (!applicationId || !coords) {
        setIsCheckingInstallation(false);
        return;
      }

      try {
        const mero = getMero();

        // First try direct UUID lookup — handles .wasm apps installed without a registry
        // entry (applicationId IS the installed UUID in this case).
        try {
          await mero.admin.getApplication(applicationId);
          localStorage.setItem('installed-application-id', applicationId);
          onComplete('', '');
          return;
        } catch (_directErr) {
          // Not found by direct UUID — fall through to package registry lookup
        }

        // Fallback: resolve package ID → installed UUID via the packages API.
        try {
          const latestResponse = await mero.admin.getLatestPackageVersion(applicationId);
          const installedId = (latestResponse as any)?.applicationId;
          if (installedId) {
            localStorage.setItem('installed-application-id', installedId);
            onComplete('', '');
            return;
          }
        } catch (_pkgErr) {
          // Package not found either — fall through to show install UI
        }

        // Neither lookup succeeded — prompt the user to install
        setIsCheckingInstallation(false);
      } catch (err) {
        // Unexpected error — show installation prompt
        console.error('Application check failed:', err);
        setIsCheckingInstallation(false);
      }
    };

    checkApplication();
  }, [applicationId, coords, onComplete]);

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

  if (!applicationId || !coords) {
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
                    const success = await checkAndInstallApplication(applicationId, coords);
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
                  const success = await checkAndInstallApplication(applicationId, coords);
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
