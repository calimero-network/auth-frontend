import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
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
import { PageShell } from '../common/PageShell';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';
import { RegistryClient, registryClient } from '../../utils/registryClient';
import { getMero, getAccessToken, setAppEndpointKey } from '../../lib/mero';

interface Manifest {
  manifest_version: string;
  id: string;
  name: string;
  version: string;
  chains?: string[];
  artifact: {
    type: string;
    target: string;
    digest: string;
    uri: string;
  };
  provides?: string[];
  _bundleMetadata?: {
    name?: string;
    description?: string;
    author?: string;
  };
  _bundleLinks?: {
    frontend?: string;
    github?: string;
    docs?: string;
  };
}

interface ManifestProcessorProps {
  onComplete: (contextId?: string, identity?: string) => void;
  onBack: () => void;
}

const PRIMARY_BTN = {
  backgroundColor: '#A5FF11',
  color: '#0A0E13',
  border: 'none',
  fontWeight: 600,
} as const;

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Flex justify="space-between" align="center" gap="sm">
      <Text size="sm" color="muted" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <span
        style={{
          fontSize: mono ? '11px' : '13px',
          fontFamily: mono ? 'monospace' : 'inherit',
          color: '#ffffff',
          fontWeight: 500,
          textAlign: 'right',
          wordBreak: 'break-all',
          maxWidth: '65%',
        }}
      >
        {value}
      </span>
    </Flex>
  );
}

export function ManifestProcessor({ onComplete, onBack }: ManifestProcessorProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState('');
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [existingAppId, setExistingAppId] = useState<string | null>(null);
  const completionInProgressRef = useRef(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    };
  }, []);

  const manifestUrl = getStoredUrlParam('manifest-url');
  const packageName = getStoredUrlParam('package-name');

  useEffect(() => {
    setAppEndpointKey(window.location.origin);
  }, []);

  const packageVersion = getStoredUrlParam('package-version');
  const registryUrl = getStoredUrlParam('registry-url');

  useEffect(() => {
    const fetchManifest = async () => {
      if (!manifestUrl && !packageName) {
        setError('No manifest URL or package name provided');
        setLoading(false);
        return;
      }

      try {
        if (packageName) {
          const client = registryUrl ? new RegistryClient(registryUrl) : registryClient;
          const manifestData = await client.getManifest(packageName, packageVersion || undefined);
          setManifest(manifestData);
          localStorage.setItem('manifest-info', JSON.stringify({
            id: manifestData.id,
            name: manifestData.name,
            version: manifestData.version,
          }));
        } else if (manifestUrl) {
          const response = await fetch(manifestUrl);
          if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.statusText}`);
          const manifestData = await response.json();

          let normalizedManifest = { ...manifestData };
          if (!normalizedManifest.artifact) {
            if (manifestData.artifacts && Array.isArray(manifestData.artifacts) && manifestData.artifacts.length > 0) {
              const firstArtifact = manifestData.artifacts[0];
              normalizedManifest.artifact = {
                type: firstArtifact.type || 'wasm',
                target: firstArtifact.target || 'node',
                digest: firstArtifact.digest || firstArtifact.sha256 || '',
                uri: firstArtifact.uri || firstArtifact.mirrors?.[0] || '',
              };
              delete normalizedManifest.artifacts;
            } else {
              normalizedManifest.artifact = { type: 'wasm', target: 'node', digest: '', uri: '' };
            }
          }
          if (normalizedManifest.artifact.uri && normalizedManifest.artifact.uri.startsWith('/')) {
            try {
              const manifestBaseUrl = new URL(manifestUrl);
              normalizedManifest.artifact.uri = new URL(normalizedManifest.artifact.uri, manifestBaseUrl.origin).toString();
            } catch (e) {
              console.warn('Failed to convert relative URI to absolute:', e);
            }
          }

          setManifest(normalizedManifest);
          localStorage.setItem('manifest-info', JSON.stringify({
            id: normalizedManifest.id,
            name: normalizedManifest.name,
            version: normalizedManifest.version,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch manifest:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch manifest');
      } finally {
        setLoading(false);
      }
    };

    fetchManifest();
  }, [manifestUrl, packageName, packageVersion, registryUrl, retryKey]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const checkExistingInstallation = async () => {
      if (!manifest) return;

      let applicationId: string | null = null;

      // First try via mero-js (expects { data: {...} } envelope)
      try {
        const mero = getMero();
        const latestResponse = await mero.admin.applications.getLatestVersion(manifest.id);
        applicationId = (latestResponse as any)?.applicationId || null;
      } catch (_meroErr) {
        // getLatestVersion can throw if the server returns the body directly
        // (no { data: {...} } wrapper). Fall back to a raw fetch.
        try {
          const token = getAccessToken();
          const res = await fetch(
            `${window.location.origin}/admin-api/packages/${encodeURIComponent(manifest.id)}/latest`,
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
          if (res.ok) {
            const json = await res.json();
            applicationId =
              json?.data?.applicationId ||
              json?.applicationId ||
              null;
          }
        } catch (fetchErr) {
          console.warn('Could not check existing installation:', fetchErr);
        }
      }

      if (applicationId && !completionInProgressRef.current) {
        completionInProgressRef.current = true;
        setAlreadyInstalled(true);
        setExistingAppId(applicationId);
        localStorage.setItem('installed-application-id', applicationId);
        onCompleteRef.current('', '');
        completionInProgressRef.current = false;
      }
    };
    checkExistingInstallation();
  }, [manifest]);

  const handleInstallAndContinue = async () => {
    if (!manifest) return;

    setInstalling(true);
    setInstallStatus(`Installing ${manifest.name}…`);

    try {
      const mero = getMero();
      const metadataObj: Record<string, any> = {
        name: manifest._bundleMetadata?.name || manifest.name,
        version: manifest.version,
        package: manifest.id,
      };
      if (manifest._bundleMetadata?.description) metadataObj.description = manifest._bundleMetadata.description;
      if (manifest._bundleMetadata?.author) metadataObj.author = manifest._bundleMetadata.author;
      if (manifest._bundleLinks) metadataObj.links = manifest._bundleLinks;
      if (!metadataObj.description && manifest.provides?.length) metadataObj.description = manifest.provides.join(', ');
      if (manifest.chains?.length) metadataObj.chains = manifest.chains;

      const metadataBytes = Array.from(new TextEncoder().encode(JSON.stringify(metadataObj)));

      const installResponse = await mero.admin.applications.installApplication({
        url: manifest.artifact.uri,
        package: manifest.id,
        version: manifest.version,
        metadata: metadataBytes,
      });

      const applicationId = (installResponse as any)?.applicationId;
      if (!applicationId) throw new Error('Installation succeeded but no application ID returned');

      localStorage.setItem('installed-application-id', applicationId);
      setExistingAppId(applicationId);
      setAlreadyInstalled(true);
      setInstalling(false);
      setInstallStatus('Installed!');

      if (completionInProgressRef.current) return;
      completionInProgressRef.current = true;

      const contextsResponse = await mero.admin.contexts.getContextsForApplication(applicationId);
      const contexts = (contextsResponse as any)?.contexts || [];
      const contextId = contexts[0]?.id || '';

      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = setTimeout(() => {
        if (completionInProgressRef.current) {
          onComplete(contextId, '');
          completionInProgressRef.current = false;
        }
        completionTimeoutRef.current = null;
      }, 500);
    } catch (err) {
      console.error('Installation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to install application');
      setInstalling(false);
    }
  };

  const handleContinueWithExisting = () => {
    if (!existingAppId || completionInProgressRef.current) return;
    completionInProgressRef.current = true;
    localStorage.setItem('installed-application-id', existingAppId);
    onComplete('', '');
    completionInProgressRef.current = false;
  };

  if (loading) return <Loader />;

  if (error) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setError(null);
          setLoading(true);
          completionInProgressRef.current = false;
          setRetryKey(k => k + 1);
        }}
        buttonText="Retry"
      />
    );
  }

  if (!manifest) {
    return (
      <PageShell>
        <Card variant="rounded" color="var(--color-border-brand)">
          <CardContent>
            <Stack spacing="lg" align="center">
              <Text color="muted">Unable to load manifest information.</Text>
              <Button variant="secondary" onClick={onBack}>Back</Button>
            </Stack>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const displayName = manifest._bundleMetadata?.name || manifest.name;
  const description = manifest._bundleMetadata?.description;

  return (
    <PageShell>
      <Card variant="rounded" color="var(--color-border-brand)">
        <CardHeader>
          <Flex align="center" gap="sm">
            {/* App icon */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(165, 255, 17, 0.1)',
                border: '1px solid rgba(165, 255, 17, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0,
              }}
            >
              📦
            </div>
            <Stack spacing="sm" style={{ flex: 1 }}>
              <CardTitle>{displayName}</CardTitle>
              <Flex align="center" gap="xs">
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#A5FF11',
                    background: 'rgba(165, 255, 17, 0.1)',
                    border: '1px solid rgba(165, 255, 17, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    letterSpacing: '0.03em',
                  }}
                >
                  v{manifest.version}
                </span>
                {alreadyInstalled && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#A5FF11',
                      background: 'rgba(165, 255, 17, 0.1)',
                      border: '1px solid rgba(165, 255, 17, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}
                  >
                    ✓ Installed
                  </span>
                )}
              </Flex>
            </Stack>
          </Flex>
        </CardHeader>

        <CardContent>
          <Stack spacing="lg">
            {description && (
              <Text size="sm" color="muted">
                {description}
              </Text>
            )}

            {/* Package Details */}
            <div
              style={{
                background: '#0A0E13',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
                padding: '14px 16px',
              }}
            >
              <Text size="xs" weight="semibold" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', display: 'block' }}>
                Package Details
              </Text>
              <Stack spacing="sm">
                <DetailRow label="ID" value={manifest.id} mono />
                <DetailRow label="Type" value={manifest.artifact.type} />
                <DetailRow label="Target" value={manifest.artifact.target} />
                {manifest.chains && manifest.chains.length > 0 && (
                  <DetailRow label="Chains" value={manifest.chains.join(', ')} />
                )}
                {manifest.provides && manifest.provides.length > 0 && (
                  <DetailRow label="Provides" value={manifest.provides.join(', ')} />
                )}
                {existingAppId && (
                  <>
                    <Divider color="muted" spacing="sm" />
                    <DetailRow label="App ID" value={existingAppId} mono />
                  </>
                )}
              </Stack>
            </div>

            {/* Installation progress */}
            {installing && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  background: 'rgba(165, 255, 17, 0.06)',
                  border: '1px solid rgba(165, 255, 17, 0.2)',
                  borderRadius: '10px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid #A5FF11',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'mpSpin 0.7s linear infinite',
                    flexShrink: 0,
                  }}
                />
                <Text size="sm" style={{ color: '#A5FF11' }}>
                  {installStatus}
                </Text>
                <style>{`@keyframes mpSpin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Author */}
            {manifest._bundleMetadata?.author && (
              <Text size="xs" color="muted">
                By {manifest._bundleMetadata.author}
              </Text>
            )}

            <Divider color="muted" spacing="sm" />

            {/* Actions */}
            <Flex justify="flex-end" gap="sm">
              <Button variant="secondary" onClick={onBack} disabled={installing}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={alreadyInstalled ? handleContinueWithExisting : handleInstallAndContinue}
                disabled={installing}
                style={PRIMARY_BTN}
              >
                {installing
                  ? 'Installing…'
                  : alreadyInstalled
                  ? 'Continue'
                  : 'Install & Continue'}
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </PageShell>
  );
}
