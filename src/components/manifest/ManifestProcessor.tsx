import React, { useState, useEffect } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
import { EmptyState } from '../common/styles';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';
import { registryClient } from '../../utils/registryClient';
import { apiClient, getAccessToken, setAppEndpointKey } from '@calimero-network/calimero-client';

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

  // Auth frontend runs on the node's domain, so use window.location.origin for admin API calls
  useEffect(() => {
    setAppEndpointKey(window.location.origin);
  }, []);

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
      localStorage.setItem('installed-application-id', applicationId);
      
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
    localStorage.setItem('installed-application-id', existingAppId);
    
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
      <EmptyState>
        <h2>No Manifest Found</h2>
        <p>Unable to load manifest information.</p>
        <Button onClick={onBack}>Back</Button>
      </EmptyState>
    );
  }

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '32px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* App Header Card */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '2px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
          {/* App Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#f1f5f9',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            flexShrink: 0
          }}>
            📦
          </div>
          
          {/* App Info */}
          <div style={{ flex: 1 }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: '#1e293b',
              marginBottom: '4px'
            }}>
              {manifest.name}
            </h2>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              v{manifest.version}
            </div>
            
            {/* Already Installed Badge */}
            {alreadyInstalled && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#d1fae5',
                color: '#065f46',
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 12px',
                borderRadius: '12px',
                marginTop: '8px'
              }}>
                <span>✓</span>
                Already Installed
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Installation Details */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
          Package Details
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#64748b' }}>Package ID:</span>
            <span style={{ color: '#1e293b', fontWeight: '500', fontFamily: 'monospace', fontSize: '12px' }}>
              {manifest.id}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#64748b' }}>Type:</span>
            <span style={{ color: '#1e293b', fontWeight: '500' }}>{manifest.artifact.type}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#64748b' }}>Target:</span>
            <span style={{ color: '#1e293b', fontWeight: '500' }}>{manifest.artifact.target}</span>
          </div>
          {manifest.chains && manifest.chains.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#64748b' }}>Chains:</span>
              <span style={{ color: '#1e293b', fontWeight: '500' }}>{manifest.chains.join(', ')}</span>
            </div>
          )}
          {manifest.provides && manifest.provides.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#64748b' }}>Provides:</span>
              <span style={{ color: '#1e293b', fontWeight: '500' }}>{manifest.provides.join(', ')}</span>
            </div>
          )}
          {alreadyInstalled && existingAppId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b' }}>Application ID:</span>
              <span style={{ color: '#10b981', fontWeight: '500', fontFamily: 'monospace', fontSize: '11px' }}>
                {existingAppId}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Installation Progress */}
      {installing && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #3b82f6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ fontSize: '14px', color: '#1e40af' }}>
              {installStatus}
            </div>
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onBack}
          disabled={installing}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#64748b',
            backgroundColor: '#f1f5f9',
            border: 'none',
            borderRadius: '6px',
            cursor: installing ? 'not-allowed' : 'pointer',
            opacity: installing ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => !installing && (e.currentTarget.style.backgroundColor = '#e2e8f0')}
          onMouseOut={(e) => !installing && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
        >
          Back
        </button>
        
        <button
          onClick={alreadyInstalled ? handleContinueWithExisting : handleInstallAndContinue}
          disabled={installing}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#ffffff',
            backgroundColor: alreadyInstalled ? '#10b981' : '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            cursor: installing ? 'not-allowed' : 'pointer',
            opacity: installing ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => !installing && (e.currentTarget.style.backgroundColor = alreadyInstalled ? '#059669' : '#2563eb')}
          onMouseOut={(e) => !installing && (e.currentTarget.style.backgroundColor = alreadyInstalled ? '#10b981' : '#3b82f6')}
        >
          {installing ? 'Installing...' : alreadyInstalled ? 'Continue to App' : 'Install & Continue'}
        </button>
      </div>
    </div>
  );
}
