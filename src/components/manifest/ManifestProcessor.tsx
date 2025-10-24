import React, { useState, useEffect } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
import { EmptyState } from '../common/styles';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';

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

interface ManifestProcessorProps {
  onComplete: (manifest: Manifest) => void;
  onBack: () => void;
}

export function ManifestProcessor({ onComplete, onBack }: ManifestProcessorProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const manifestUrl = getStoredUrlParam('manifest-url');
  const registryUrl = getStoredUrlParam('registry-url');

  useEffect(() => {
    const fetchManifest = async () => {
      if (!manifestUrl && !registryUrl) {
        setError('No manifest URL or registry URL provided');
        setLoading(false);
        return;
      }

      try {
        if (manifestUrl) {
          // Direct manifest URL provided
          const response = await fetch(manifestUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch manifest: ${response.statusText}`);
          }
          const manifestData = await response.json();
          setManifest(manifestData);
        } else if (registryUrl) {
          // Registry URL provided - need to discover packages
          setError('Package discovery not yet implemented');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch manifest:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch manifest');
      } finally {
        setLoading(false);
      }
    };

    fetchManifest();
  }, [manifestUrl, registryUrl]);

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
          <Button onClick={onBack} style={{ marginRight: '10px' }}>
            Back
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
