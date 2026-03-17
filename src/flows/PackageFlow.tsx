import React, { useMemo, useState } from 'react';
import { generateClientKeyDirect } from '../lib/mero';
import { ManifestProcessor } from '../components/manifest/ManifestProcessor';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ContextSelector } from '../components/context/ContextSelector';
import { ErrorView } from '../components/common/ErrorView';
import Loader from '../components/common/Loader';
import { PageShell } from '../components/common/PageShell';
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
 * 4. Select context (if single-context mode)
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
  const [generating, setGenerating] = useState(false);

  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    const rawPermissions = permissionsParam ? permissionsParam.split(',') : [];
    return normalizePermissions(mode, rawPermissions);
  }, [mode]);

  const handleManifestComplete = () => {
    const appId =
      localStorage.getItem('installed-application-id') ||
      sessionStorage.getItem('installed-application-id');
    if (appId) {
      setInstalledAppId(appId);

      const manifestInfoStr = localStorage.getItem('manifest-info');
      if (manifestInfoStr) {
        try {
          setManifestInfo(JSON.parse(manifestInfoStr));
        } catch (e) {
          console.warn('Failed to parse manifest info:', e);
        }
      }

      setStep('permissions');
    } else {
      setError('Application installation failed — no application ID returned');
    }
  };

  const handlePermissionsApprove = async () => {
    if (mode === 'single-context') {
      setStep('context-selection');
    } else {
      setStep('summary');
    }
  };

  const generateAndRedirect = async (contextId: string | null, identity: string | null) => {
    setGenerating(true);
    try {
      let scopedPermissions = [...permissions];

      if (installedAppId) {
        scopedPermissions = scopedPermissions.map(perm =>
          perm.startsWith('context:') ? `${perm}[${installedAppId}]` : perm
        );
      }

      const response = await generateClientKeyDirect({
        context_id: contextId || '',
        context_identity: identity || '',
        permissions: scopedPermissions,
      });

      if (response.access_token && response.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (!callback) {
          setError('Missing callback URL');
          setGenerating(false);
          return;
        }

        const returnUrl = new URL(callback);
        const fragmentParams = new URLSearchParams();
        fragmentParams.set('access_token', response.access_token);
        fragmentParams.set('refresh_token', response.refresh_token);

        if (installedAppId) {
          fragmentParams.set('application_id', installedAppId);
        }
        if (contextId) {
          fragmentParams.set('context_id', contextId);
        }
        if (identity) {
          fragmentParams.set('context_identity', identity);
        }

        sessionStorage.removeItem('installed-application-id');
        localStorage.removeItem('installed-application-id');
        localStorage.removeItem('manifest-info');
        clearStoredUrlParams();
        window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate token:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate token');
      setGenerating(false);
    }
  };

  if (generating) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setError(null);
          setStep('manifest');
        }}
      />
    );
  }

  return (
    <>
      {step === 'manifest' && (
        <ManifestProcessor
          onComplete={handleManifestComplete}
          onBack={() => window.history.back()}
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
            if (mode === 'single-context') {
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

function truncate(str: string, head = 10, tail = 6) {
  if (!str || str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
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
    <PageShell>
      <Card variant="rounded" color="var(--color-border-brand)" style={{ width: '100%' }}>
        <CardHeader>
          {/* App identity row */}
          {manifest ? (
            <Flex align="center" gap="sm">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(165,255,17,0.1)',
                  border: '1px solid rgba(165,255,17,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                📦
              </div>
              <Stack spacing="sm" style={{ flex: 1 }}>
                <CardTitle>{manifest.name}</CardTitle>
                <Text size="xs" color="muted" style={{ fontFamily: 'monospace' }}>
                  {manifest.id}@{manifest.version}
                </Text>
              </Stack>
            </Flex>
          ) : (
            <CardTitle>Review & Confirm</CardTitle>
          )}
        </CardHeader>

        <CardContent>
          <Stack spacing="lg">
            {/* Details block */}
            <div
              style={{
                background: '#0A0E13',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
                padding: '14px 16px',
              }}
            >
              <Stack spacing="sm">
                {applicationId && (
                  <Flex justify="space-between" align="center">
                    <Text size="xs" color="muted" style={{ flexShrink: 0 }}>Application ID</Text>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ffffff', textAlign: 'right' }}>
                      {truncate(applicationId)}
                    </span>
                  </Flex>
                )}
                {contextId && (
                  <>
                    {applicationId && <Divider color="muted" spacing="sm" />}
                    <Flex justify="space-between" align="center">
                      <Text size="xs" color="muted" style={{ flexShrink: 0 }}>Context ID</Text>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ffffff', textAlign: 'right' }}>
                        {truncate(contextId)}
                      </span>
                    </Flex>
                    {identity && (
                      <Flex justify="space-between" align="center">
                        <Text size="xs" color="muted" style={{ flexShrink: 0 }}>Identity</Text>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#A5FF11', textAlign: 'right' }}>
                          {truncate(identity)}
                        </span>
                      </Flex>
                    )}
                  </>
                )}
                {!contextId && (
                  <Text size="xs" color="muted">
                    {mode === 'single-context'
                      ? 'Context will be selected in the next step.'
                      : 'Multi-context access — no specific context locked in.'}
                  </Text>
                )}
              </Stack>
            </div>

            {/* Permissions */}
            <Stack spacing="sm">
              <Text size="xs" weight="semibold" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Permissions
              </Text>
              <div
                style={{
                  background: '#0A0E13',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}
              >
                <Stack spacing="sm">
                  {permissions.map((permission) => (
                    <span
                      key={permission}
                      style={{
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#A5FF11',
                        background: 'rgba(165,255,17,0.06)',
                        border: '1px solid rgba(165,255,17,0.15)',
                        padding: '3px 8px',
                        borderRadius: '5px',
                        display: 'inline-block',
                        width: 'fit-content',
                      }}
                    >
                      {permission}
                    </span>
                  ))}
                </Stack>
              </div>
            </Stack>

            <Divider color="muted" spacing="sm" />

            <Flex justify="flex-end" gap="sm">
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!isReady}
                onClick={onConfirm}
                style={{
                  backgroundColor: '#A5FF11',
                  color: '#0A0E13',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                Generate Token
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </PageShell>
  );
};
