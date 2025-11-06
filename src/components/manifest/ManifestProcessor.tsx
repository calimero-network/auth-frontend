import React, { useState, useEffect } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';
import { registryClient } from '../../utils/registryClient';
import { apiClient, getAccessToken } from '@calimero-network/calimero-client';
import {
  Alert,
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
}

interface ManifestProcessorProps {
  onComplete: (contextId: string, identity: string) => void;
  onBack: () => void;
  packageName?: string | null;
  packageVersion?: string | null;
  registryUrl?: string | null;
}

export function ManifestProcessor({ 
  onComplete, 
  onBack,
  packageName: propPackageName,
  packageVersion: propPackageVersion,
  registryUrl: propRegistryUrl
}: ManifestProcessorProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState('');
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [existingAppId, setExistingAppId] = useState<string | null>(null);

  // Use props (from state) if provided, otherwise fall back to URL params
  const manifestUrl = getStoredUrlParam('manifest-url');
  const packageName = propPackageName || getStoredUrlParam('package-name');
  const packageVersion = propPackageVersion || getStoredUrlParam('package-version');
  const registryUrl = propRegistryUrl || getStoredUrlParam('registry-url');

  // Fetch manifest
  useEffect(() => {
    const fetchManifest = async () => {
      if (!manifestUrl && !packageName) {
        setError('No manifest URL or package name provided');
        setLoading(false);
        return;
      }

      try {
        // Prioritize package-name over old manifest-url in localStorage
        if (packageName) {
          console.log(`Fetching manifest from registry for package: ${packageName}@${packageVersion || 'latest'}`);
          
          const client = registryUrl ? 
            new (await import('../../utils/registryClient')).RegistryClient(registryUrl) : 
            registryClient;
          
          const manifestData = await client.getManifest(packageName, packageVersion || undefined);
          console.log('Fetched manifest:', manifestData);
          console.log('Registry client base URL:', client['baseUrl']);
          setManifest(manifestData);
        } else if (manifestUrl) {
          console.log('Fetching manifest from URL:', manifestUrl);
          const response = await fetch(manifestUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch manifest: ${response.statusText}`);
          }
          const manifestData = await response.json();
          setManifest(manifestData);
        }
      } catch (err) {
        console.error('Failed to fetch manifest:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch manifest');
      } finally {
        setLoading(false);
      }
    };

    fetchManifest();
  }, [manifestUrl, packageName, packageVersion, registryUrl]);

  // Check if already installed
  useEffect(() => {
    const checkExistingInstallation = async () => {
      if (!manifest) return;
      
      try {
        console.log('Checking if package is already installed:', manifest.id);
        
        // Try to get latest version of this package
        const latestResponse = await apiClient.admin().getPackageLatest(manifest.id);
        
        if (!latestResponse.error && latestResponse.data?.application_id) {
          console.log('Package already installed!', latestResponse.data.application_id);
          setAlreadyInstalled(true);
          setExistingAppId(latestResponse.data.application_id);
        } else {
          console.log('Package not installed yet');
        }
      } catch (err) {
        console.warn('Could not check existing installation:', err);
        // Not a fatal error - continue with installation flow
      }
    };

    checkExistingInstallation();
  }, [manifest]);

  const handleInstallAndContinue = async () => {
    if (!manifest) return;

    console.log('Starting installation for:', manifest.id);
    setInstalling(true);
    setInstallStatus('Installing application...');
    
    try {
      // Install the package
      setInstallStatus(`Installing ${manifest.id}@${manifest.version}...`);
      
      const installResponse = await apiClient.admin().installApplication({
        url: manifest.artifact.uri,
        package: manifest.id,
        version: manifest.version,
        metadata: []
      });
      
      if (installResponse.error) {
        throw new Error(`Failed to install: ${installResponse.error.message}`);
      }
      
      const applicationId = installResponse.data?.data?.applicationId || 
                           (installResponse.data as any)?.applicationId;
      
      if (!applicationId) {
        throw new Error('Installation succeeded but no application ID returned');
      }
      
      console.log('Installation successful! App ID:', applicationId);
      setInstallStatus('Application installed successfully!');
      
      // Store applicationId for permission scoping in JWT generation
      sessionStorage.setItem('installed-application-id', applicationId);
      
      // Get contexts
      setInstallStatus('Fetching contexts...');
      const contextsResponse = await apiClient.admin().getContextsForApplication(applicationId);
      
      const contexts = (contextsResponse.data as any)?.contexts || [];
      console.log('Application contexts:', contexts);
      
      // Complete with first context or empty for application-level token
      const contextId = contexts[0]?.id || '';
      console.log('Completing with context:', contextId || '(application-level)');
      
      onComplete(contextId, '');
      
    } catch (err) {
      console.error('Installation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to install application');
      setInstalling(false);
    }
  };

  const handleContinueWithExisting = () => {
    if (!existingAppId) return;
    
    console.log('Continuing with existing app:', existingAppId);
    
    // Store applicationId for permission scoping in JWT generation
    sessionStorage.setItem('installed-application-id', existingAppId);
    
    // Just complete the flow - app is already installed
    onComplete('', '');
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorView 
        message={error} 
        onRetry={() => {
          setError(null);
          setLoading(true);
          window.location.reload();
        }} 
        buttonText="Retry"
      />
    );
  }

  if (!manifest) {
    return (
      <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 600, margin: '0 auto' }}>
        <CardHeader>
          <CardTitle>No Manifest Found</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack spacing="md" align="center">
            <Text color="muted">Unable to load manifest information.</Text>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ 
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 600,
      width: '100%',
      padding: '0 16px',
    }}>
      <Card variant="rounded" color="var(--color-border-brand)">
        <CardContent>
          <Stack spacing="lg">
            {/* App Header */}
            <Flex align="flex-start" gap="md">
              {/* App Icon */}
              <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: tokens.color.background.tertiary.value,
                borderRadius: tokens.radius.lg.value,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                flexShrink: 0
              }}>
                📦
              </div>
              
              {/* App Info */}
              <Stack spacing="xs" style={{ flex: 1 }}>
                <Text size="lg" weight="bold">
                  {manifest.name}
                </Text>
                <Text size="sm" color="muted">
                  v{manifest.version}
                </Text>
                
                {/* Already Installed Badge */}
                {alreadyInstalled && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: tokens.color.semantic.success.value + '20',
                    color: tokens.color.semantic.success.value,
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '4px 10px',
                    borderRadius: tokens.radius.sm.value,
                    width: 'fit-content'
                  }}>
                    <span>✓</span>
                    Already Installed
                  </div>
                )}
              </Stack>
            </Flex>

            <Divider color="muted" />
            
            {/* Installation Details */}
            <Stack spacing="sm">
              <Text size="sm" weight="semibold">Package Details</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Flex justify="space-between">
                  <Text size="xs" color="secondary">Package ID:</Text>
                  <Text size="xs" style={{ fontFamily: 'monospace' }}>
                    {manifest.id}
                  </Text>
                </Flex>
                <Flex justify="space-between">
                  <Text size="xs" color="secondary">Type:</Text>
                  <Text size="xs">{manifest.artifact.type}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text size="xs" color="secondary">Target:</Text>
                  <Text size="xs">{manifest.artifact.target}</Text>
                </Flex>
                {manifest.chains && manifest.chains.length > 0 && (
                  <Flex justify="space-between">
                    <Text size="xs" color="secondary">Chains:</Text>
                    <Text size="xs">{manifest.chains.join(', ')}</Text>
                  </Flex>
                )}
                {manifest.provides && manifest.provides.length > 0 && (
                  <Flex justify="space-between">
                    <Text size="xs" color="secondary">Provides:</Text>
                    <Text size="xs">{manifest.provides.join(', ')}</Text>
                  </Flex>
                )}
                {alreadyInstalled && existingAppId && (
                  <>
                    <Divider color="subtle" spacing="xs" />
                    <Flex justify="space-between">
                      <Text size="xs" color="secondary">Application ID:</Text>
                      <Text size="xs" style={{ 
                        fontFamily: 'monospace',
                        color: tokens.color.semantic.success.value
                      }}>
                        {existingAppId}
                      </Text>
                    </Flex>
                  </>
                )}
              </div>
            </Stack>
            
            {/* Installation Progress */}
            {installing && (
              <Alert variant="info" size="sm">
                <Flex gap="sm" align="center">
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${tokens.color.brand['500'].value}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <Text size="xs">{installStatus}</Text>
                </Flex>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </Alert>
            )}
            
            {/* Action Buttons */}
            <Flex justify="flex-end" gap="sm">
              <Button
                variant="secondary"
                onClick={onBack}
                disabled={installing}
              >
                Back
              </Button>
              
              <Button
                variant="primary"
                onClick={alreadyInstalled ? handleContinueWithExisting : handleInstallAndContinue}
                disabled={installing}
                style={{
                  color: 'var(--color-text-brand)',
                  borderColor: 'var(--color-border-brand)',
                }}
              >
                {installing ? 'Installing...' : alreadyInstalled ? 'Continue to App' : 'Install & Continue'}
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </div>
  );
}
