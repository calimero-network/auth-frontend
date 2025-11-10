import React, { useMemo, useState } from 'react';
import { apiClient, getAppEndpointKey } from '@calimero-network/calimero-client';
import { ManifestProcessor } from '../components/manifest/ManifestProcessor';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ContextSelector } from '../components/context/ContextSelector';
import { ErrorView } from '../components/common/ErrorView';
import { AppMode } from '../types/flows';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';
import { normalizePermissions } from '../utils/permissions';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  Flex,
  Stack,
  Text,
} from '@calimero-network/mero-ui';
import { tokens } from '@calimero-network/mero-tokens';

interface PackageFlowProps {
  mode: AppMode;
  packageName: string;
  packageVersion?: string;
  registryUrl?: string;
}

type Step = 'manifest' | 'permissions' | 'context-selection' | 'summary';

/**
 * PackageFlow - Handles package-based token generation
 * 
 * Flow:
 * 1. Fetch manifest from registry (+ show dev warning if non-prod)
 * 2. Install application
 * 3. Review permissions
 * 4. Select context (if multi-context mode)
 * 5. Generate scoped token and redirect
 */
export const PackageFlow: React.FC<PackageFlowProps> = ({
  mode,
  packageName,
  packageVersion,
  registryUrl
}) => {
  const [step, setStep] = useState<Step>('manifest');
  const [installedAppId, setInstalledAppId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manifestInfo, setManifestInfo] = useState<any>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);

  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    const rawPermissions = permissionsParam ? permissionsParam.split(',') : [];
    return normalizePermissions(mode, rawPermissions);
  }, [mode]);

  const handleManifestComplete = (contextId?: string, identity?: string) => {
    // ManifestProcessor might complete with contextId if it handled context selection
    // For now, just proceed to permissions
    const appId = sessionStorage.getItem('installed-application-id');
    if (appId) {
      setInstalledAppId(appId);
      setStep('permissions');
    } else {
      setError('Application installation failed - no application ID');
    }
  };

  const handlePermissionsApprove = async () => {
    // Single-context mode requires context selection (user picks ONE context)
    // Multi-context mode skips selection (app manages contexts itself)
    if (mode === 'single-context') {
      setStep('context-selection');
    } else {
      setStep('summary');
    }
  };

  const generateAndRedirect = async (contextId: string | null, identity: string | null) => {
    try {
      let scopedPermissions = [...permissions];

      // Scope permissions to the installed application
      if (installedAppId) {
        scopedPermissions = scopedPermissions.map(perm => {
          if (perm.startsWith('context:')) {
            return `${perm}[${installedAppId}]`;
          }
          return perm;
        });
      }

      const response = await apiClient.auth().generateClientKey({
        context_id: contextId || '',
        context_identity: identity || '',
        permissions: scopedPermissions,
        target_node_url: getAppEndpointKey() || ''
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data.access_token && response.data.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (!callback) {
          setError('Missing callback URL');
          return;
        }

        const returnUrl = new URL(callback);
        const fragmentParams = new URLSearchParams();
        fragmentParams.set('access_token', response.data.access_token);
        fragmentParams.set('refresh_token', response.data.refresh_token);
        
        if (installedAppId) {
          fragmentParams.set('application_id', installedAppId);
        }

        sessionStorage.removeItem('installed-application-id');
        clearStoredUrlParams();
        window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate token:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    }
  };

  if (error) {
    return <ErrorView message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <>
      {step === 'manifest' && (
        <ManifestProcessor
          onComplete={handleManifestComplete}
          onBack={() => window.history.back()}
          packageName={packageName}
          packageVersion={packageVersion}
          registryUrl={registryUrl}
          onManifestLoaded={setManifestInfo}
        />
      )}

      {step === 'permissions' && (
        <PermissionsView
          permissions={permissions}
          selectedContext=""
          selectedIdentity=""
          mode={mode}
          onComplete={handlePermissionsApprove}
          onBack={() => setStep('manifest')}
        />
      )}

      {step === 'context-selection' && mode === 'single-context' && (
        <ContextSelector
          onComplete={(contextId, identity) => {
            setSelectedContextId(contextId);
            setSelectedIdentity(identity);
            setStep('summary');
          }}
          onBack={() => setStep('permissions')}
        />
      )}

      {step === 'summary' && (
        <SummaryView
          manifest={manifestInfo}
          permissions={permissions}
          contextId={selectedContextId}
          identity={selectedIdentity}
          applicationId={installedAppId}
          mode={mode}
          onBack={() => {
            if (mode === 'single-context' && !selectedContextId) {
              setStep('context-selection');
            } else {
              setStep('permissions');
            }
          }}
          onConfirm={() => generateAndRedirect(selectedContextId, selectedIdentity)}
        />
      )}
    </>
  );
};

interface SummaryViewProps {
  manifest: any;
  permissions: string[];
  contextId: string | null;
  identity: string | null;
  applicationId: string | null;
  mode: AppMode;
  onBack: () => void;
  onConfirm: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({
  manifest,
  permissions,
  contextId,
  identity,
  applicationId,
  mode,
  onBack,
  onConfirm,
}) => {
  const isReady = permissions.length > 0 && (!!contextId || contextId === null);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px 64px',
        background: 'var(--color-background-primary)',
      }}
    >
      <Card variant="rounded" color="var(--color-border-brand)" style={{ width: '100%', maxWidth: 620 }}>
        <CardHeader>
          <CardTitle>Review & Confirm</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack spacing="lg">
            {manifest && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${tokens.color.brand['600'].value}`,
                  background: `${tokens.color.brand['600'].value}14`,
                  color: 'var(--color-text-primary)',
                }}
              >
                <span style={{ fontSize: '24px', flexShrink: 0 }}>📦</span>
                <Stack spacing="xs">
                  <Text weight="semibold" size="md">
                    {manifest.name}
                  </Text>
                  <Text size="sm" color="muted">
                    Package: {manifest.id}@{manifest.version}
                  </Text>
                </Stack>
              </div>
            )}

            {applicationId && (
              <Stack spacing="xs">
                <Text size="xs" color="muted">
                  Application ID
                </Text>
                <Text size="sm" style={{ fontFamily: 'monospace' }}>
                  {applicationId}
                </Text>
              </Stack>
            )}

            <Stack spacing="sm">
              <Text weight="semibold" size="sm">
                Context
              </Text>
              {contextId ? (
                <Stack spacing="xs">
                  <Text size="xs" color="muted">
                    Context ID
                  </Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>
                    {contextId}
                  </Text>
                  {identity && (
                    <Text size="xs" color="secondary">
                      Identity: {identity}
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="xs" color="muted">
                  {mode === 'single-context'
                    ? 'Context will be fixed once you select or create one.'
                    : 'This authorization grants the application access to manage multiple contexts.'}
                </Text>
              )}
            </Stack>

            <Divider color="muted" />

            <Stack spacing="sm">
              <Text weight="semibold" size="sm">
                Permissions
              </Text>
              <Stack spacing="xs">
                {permissions.map((permission) => (
                  <Text key={permission} size="xs" style={{ fontFamily: 'monospace' }}>
                    {permission}
                  </Text>
                ))}
              </Stack>
            </Stack>

            <Flex justify="flex-end" gap="sm">
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!isReady}
                onClick={onConfirm}
                style={{
                  color: 'var(--color-text-brand)',
                  borderColor: 'var(--color-border-brand)',
                }}
              >
                Generate Token
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </div>
  );
};

