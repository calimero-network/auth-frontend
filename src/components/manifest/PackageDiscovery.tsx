import React, { useState, useEffect } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
import { EmptyState } from '../common/styles';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';

interface Package {
  id: string;
  name: string;
  description?: string;
  latest_version: string;
}

interface Version {
  version: string;
  manifest_url: string;
}

interface PackageDiscoveryProps {
  onComplete: (manifest: any) => void;
  onBack: () => void;
}

export function PackageDiscovery({ onComplete, onBack }: PackageDiscoveryProps) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const registryUrl = getStoredUrlParam('registry-url');

  useEffect(() => {
    const fetchPackages = async () => {
      if (!registryUrl) {
        setError('No registry URL provided');
        setLoading(false);
        return;
      }

      try {
        // Fetch available packages from registry
        const response = await fetch(`${registryUrl}/packages`);
        if (!response.ok) {
          throw new Error(`Failed to fetch packages: ${response.statusText}`);
        }
        const packagesData = await response.json();
        setPackages(packagesData.packages || []);
      } catch (err) {
        console.error('Failed to fetch packages:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch packages');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [registryUrl]);

  const handlePackageSelect = async (pkg: Package) => {
    setSelectedPackage(pkg);
    setLoading(true);
    setError(null);

    try {
      // Fetch versions for the selected package
      const response = await fetch(`${registryUrl}/packages/${pkg.id}/versions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch versions: ${response.statusText}`);
      }
      const versionsData = await response.json();
      setVersions(versionsData.versions || []);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch versions');
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSelect = async (version: Version) => {
    setSelectedVersion(version);
    setLoading(true);
    setError(null);

    try {
      // Fetch manifest for the selected version
      const response = await fetch(version.manifest_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }
      const manifestData = await response.json();
      setManifest(manifestData);
    } catch (err) {
      console.error('Failed to fetch manifest:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch manifest');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallApplication = async () => {
    if (!manifest) return;

    setInstalling(true);
    try {
      // Store manifest data for later use
      localStorage.setItem('manifest-data', JSON.stringify(manifest));
      
      onComplete(manifest);
    } catch (err) {
      console.error('Failed to process manifest:', err);
      setError(err instanceof Error ? err.message : 'Failed to process manifest');
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

  if (!selectedPackage && packages.length === 0) {
    return (
      <EmptyState>
        <h2>No Packages Available</h2>
        <p>No packages found in the registry.</p>
        <Button onClick={onBack}>Back</Button>
      </EmptyState>
    );
  }

  if (!selectedPackage) {
    return (
      <EmptyState>
        <h2>Select Package</h2>
        <div data-testid="package-list" style={{ textAlign: 'left', margin: '20px 0' }}>
          {packages.map((pkg) => (
            <div 
              key={pkg.id} 
              data-testid="package-item"
              style={{ 
                padding: '10px', 
                border: '1px solid #ddd', 
                margin: '5px 0', 
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              onClick={() => handlePackageSelect(pkg)}
            >
              <strong>{pkg.name}</strong>
              <br />
              <small>{pkg.id}</small>
              {pkg.description && <p>{pkg.description}</p>}
            </div>
          ))}
        </div>
        <Button onClick={onBack}>Back</Button>
      </EmptyState>
    );
  }

  if (!selectedVersion && versions.length === 0) {
    return (
      <EmptyState>
        <h2>No Versions Available</h2>
        <p>No versions found for {selectedPackage.name}.</p>
        <Button onClick={() => setSelectedPackage(null)}>Back to Packages</Button>
      </EmptyState>
    );
  }

  if (!selectedVersion) {
    return (
      <EmptyState>
        <h2>Select Version</h2>
        <p>Choose a version for {selectedPackage.name}:</p>
        <div data-testid="version-list" style={{ textAlign: 'left', margin: '20px 0' }}>
          {versions.map((version) => (
            <div 
              key={version.version} 
              data-testid="version-item"
              style={{ 
                padding: '10px', 
                border: '1px solid #ddd', 
                margin: '5px 0', 
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              onClick={() => handleVersionSelect(version)}
            >
              <strong>{version.version}</strong>
            </div>
          ))}
        </div>
        <Button onClick={() => setSelectedPackage(null)}>Back to Packages</Button>
      </EmptyState>
    );
  }

  if (!manifest) {
    return (
      <EmptyState>
        <h2>Loading Manifest...</h2>
        <p>Fetching manifest for {selectedPackage.name} {selectedVersion.version}</p>
        <Loader />
      </EmptyState>
    );
  }

  return (
    <EmptyState>
      <div data-testid="manifest-info">
        <h2>{manifest.name}</h2>
        <div style={{ textAlign: 'left', margin: '20px 0' }}>
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
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button onClick={() => setSelectedVersion(null)} style={{ marginRight: '10px' }}>
            Back to Versions
          </Button>
          <Button 
            onClick={handleInstallApplication}
            disabled={installing}
            primary
          >
            {installing ? 'Processing...' : 'Install Application'}
          </Button>
        </div>
      </div>
    </EmptyState>
  );
}
