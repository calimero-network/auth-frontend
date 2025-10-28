import React, { useState, useEffect } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
import { EmptyState } from '../common/styles';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';
import { apiClient, getAccessToken } from '@calimero-network/calimero-client';

interface Manifest {
  manifest_version: string;
  id: string;
  name: string;
  version: string;
  chains: string[];
  artifact: {
    type: string;
    target: string;
    digest: string;
    uri: string;
  };
  provides: string[];
}

interface PackageInstallFlowProps {
  onComplete: (contextId: string, identity: string) => void;
  onBack: () => void;
}

export function PackageInstallFlow({ onComplete, onBack }: PackageInstallFlowProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string>('');

  const manifestUrl = getStoredUrlParam('manifest-url');
  const registryUrl = getStoredUrlParam('registry-url');

  useEffect(() => {
    // Get manifest data from localStorage (set by ManifestProcessor)
    const storedManifest = localStorage.getItem('manifest-data');
    if (storedManifest) {
      try {
        const manifestData = JSON.parse(storedManifest);
        setManifest(manifestData);
        setLoading(false);
        console.log('DEBUG: Using stored manifest data:', manifestData);
      } catch (err) {
        console.error('Failed to parse stored manifest:', err);
        setError('Failed to parse stored manifest data');
        setLoading(false);
      }
    } else {
      setError('No manifest data found in localStorage');
      setLoading(false);
    }
  }, []);

  const handlePackageInstall = async () => {
    if (!manifest) return;

    console.log('DEBUG: Starting package installation for manifest:', manifest);
    setInstalling(true);
    setInstallStatus('Starting package installation...');
    
    try {
      const packageName = manifest.id;
      const version = manifest.version;
      
      // Step 1: Get available packages
      setInstallStatus('Fetching available packages...');
      const packagesResponse = await fetch('http://node1.127.0.0.1.nip.io/admin-api/packages', {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      if (!packagesResponse.ok) {
        throw new Error(`Failed to fetch packages: ${packagesResponse.statusText}`);
      }
      const { packages } = await packagesResponse.json();
      console.log('Available packages:', packages);
      
      // Step 2: Get package versions
      setInstallStatus(`Getting versions for package ${packageName}...`);
      const versionsResponse = await fetch(`http://node1.127.0.0.1.nip.io/admin-api/packages/${packageName}/versions`, {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      if (!versionsResponse.ok) {
        throw new Error(`Failed to fetch versions: ${versionsResponse.statusText}`);
      }
      const { versions } = await versionsResponse.json();
      console.log('Available versions:', versions);
      
      // Step 3: Check if application already exists
      setInstallStatus('Checking if application already exists...');
      const latestResponse = await fetch(`http://node1.127.0.0.1.nip.io/admin-api/packages/${packageName}/latest`, {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      if (!latestResponse.ok) {
        throw new Error(`Failed to fetch latest: ${latestResponse.statusText}`);
      }
      const latestData = await latestResponse.json();
      
      let applicationId: string;
      
      if (latestData.application_id) {
        // Application already exists
        applicationId = latestData.application_id;
        setInstallStatus('Application already exists, using existing installation');
      } else {
        // Step 4: Install the application
        setInstallStatus(`Installing application ${packageName} version ${version}...`);
        const installResponse = await fetch('http://node1.127.0.0.1.nip.io/admin-api/install-application', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: manifest.artifact.uri,
            package: packageName,
            version: version,
            metadata: []
          })
        });
        
        if (!installResponse.ok) {
          throw new Error(`Failed to install application: ${installResponse.statusText}`);
        }
        
        const installData = await installResponse.json();
        applicationId = installData.data.applicationId;
        setInstallStatus('Application installed successfully');
      }
      
      // Step 5: Get application contexts
      setInstallStatus('Getting application contexts...');
      const contextsResponse = await fetch(`http://node1.127.0.0.1.nip.io/admin-api/contexts/for-application/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      if (!contextsResponse.ok) {
        throw new Error(`Failed to fetch contexts: ${contextsResponse.statusText}`);
      }
      
      const contextsData = await contextsResponse.json();
      const contexts = contextsData.data.contexts;
      console.log('Application contexts:', contexts);
      
      // Step 6: Get contexts with executors for more detailed info
      setInstallStatus('Getting context executors...');
      const contextsWithExecutorsResponse = await fetch(`http://node1.127.0.0.1.nip.io/admin-api/contexts/with-executors/for-application/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`
        }
      });
      if (!contextsWithExecutorsResponse.ok) {
        console.warn('Could not get executors:', contextsWithExecutorsResponse.statusText);
      } else {
        const executorsData = await contextsWithExecutorsResponse.json();
        console.log('Contexts with executors:', executorsData.contexts);
      }
      
             if (contexts.length === 0) {
               // No contexts exist, we need to create one
               setInstallStatus('No contexts found, proceeding to context creation...');
               // For manifest flow, we don't need contexts - just redirect to callback
               setInstallStatus('Application installed successfully! Redirecting to callback...');
               console.log('DEBUG: Redirecting to callback (no contexts found)');
               // Redirect to callback URL
               const callbackUrl = localStorage.getItem('callback-url') || '/callback';
               window.location.href = callbackUrl;
               return;
             }
             
             // Use the first available context
             const firstContext = contexts[0];
             setInstallStatus(`Application installed successfully! Using context ${firstContext.id}`);
             
             // Redirect to callback URL with context
             console.log('DEBUG: Redirecting to callback with context:', firstContext.id);
             const callbackUrl = localStorage.getItem('callback-url') || '/callback';
             window.location.href = callbackUrl;
      
    } catch (err) {
      console.error('Failed to install package:', err);
      setError(err instanceof Error ? err.message : 'Failed to install package');
    } finally {
      setInstalling(false);
    }
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
    <EmptyState>
      <div data-testid="manifest-info">
        <h2>{manifest.name}</h2>
        <div style={{ textAlign: 'left', margin: '20px 0' }}>
          <h3>{manifest.name}</h3>
          <p><strong>Package ID:</strong> {manifest.id}</p>
          <p><strong>Version:</strong> {manifest.version}</p>
          <p><strong>Manifest Version:</strong> {manifest.manifest_version}</p>
          <p><strong>Chains:</strong> {manifest.chains.join(', ')}</p>
          <p><strong>Artifact Type:</strong> {manifest.artifact.type}</p>
          <p><strong>Target:</strong> {manifest.artifact.target}</p>
          <p><strong>Digest:</strong> {manifest.artifact.digest}</p>
          {manifest.provides.length > 0 && (
            <p><strong>Provides:</strong> {manifest.provides.join(', ')}</p>
          )}
        </div>
        
        {installStatus && (
          <div data-testid="install-status" style={{ margin: '20px 0', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <p><strong>Status:</strong> {installStatus}</p>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button onClick={onBack} style={{ marginRight: '10px' }}>
            Back
          </Button>
          {!installing && installStatus.includes('successfully') ? (
            <Button 
              onClick={() => {
                console.log('DEBUG: Complete Installation button clicked - redirecting to callback');
                const callbackUrl = localStorage.getItem('callback-url') || '/callback';
                window.location.href = callbackUrl;
              }}
              primary
            >
              Complete Installation
            </Button>
          ) : (
            <Button 
              onClick={() => {
                console.log('DEBUG: Install Application button clicked');
                handlePackageInstall();
              }}
              disabled={installing}
              primary
            >
              {installing ? 'Installing...' : 'Install Application'}
            </Button>
          )}
        </div>
      </div>
    </EmptyState>
  );
}
