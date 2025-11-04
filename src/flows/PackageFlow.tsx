import React, { useState } from 'react';
import { apiClient, getAppEndpointKey } from '@calimero-network/calimero-client';
import { ManifestProcessor } from '../components/manifest/ManifestProcessor';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ContextSelector } from '../components/context/ContextSelector';
import { DevRegistryWarning } from '../components/steps/DevRegistryWarning';
import { ErrorView } from '../components/common/ErrorView';
import { AppMode } from '../types/flows';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';

interface PackageFlowProps {
  mode: AppMode;
  packageName: string;
  packageVersion?: string;
  registryUrl?: string;
}

type Step = 'manifest' | 'permissions' | 'context-selection' | 'complete';

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

  const handleManifestComplete = (contextId?: string, identity?: string) => {
    // ManifestProcessor might complete with contextId if it handled context selection
    // For now, just proceed to permissions
    const appId = localStorage.getItem('installed-application-id');
    if (appId) {
      setInstalledAppId(appId);
      setStep('permissions');
    } else {
      setError('Application installation failed - no application ID');
    }
  };

  const handlePermissionsApprove = async () => {
    // If multi-context mode, show context selection
    if (mode === 'multi-context') {
      setStep('context-selection');
    } else {
      // Single-context mode: generate token immediately
      await generateAndRedirect(null, null);
    }
  };

  const generateAndRedirect = async (contextId: string | null, identity: string | null) => {
    try {
      const permissionsParam = getStoredUrlParam('permissions');
      let permissions = permissionsParam ? permissionsParam.split(',') : [];

      // Scope permissions to the installed application
      if (installedAppId) {
        permissions = permissions.map(perm => {
          if (perm.startsWith('context:')) {
            return `${perm}[${installedAppId}]`;
          }
          return perm;
        });
      }

      const response = await apiClient.auth().generateClientKey({
        context_id: contextId || '',
        context_identity: identity || '',
        permissions,
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

        localStorage.removeItem('installed-application-id');
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
      {registryUrl && <DevRegistryWarning registryUrl={registryUrl} />}
      
      {step === 'manifest' && (
        <ManifestProcessor
          onComplete={handleManifestComplete}
          onBack={() => window.history.back()}
          packageName={packageName}
          packageVersion={packageVersion}
          registryUrl={registryUrl}
        />
      )}

      {step === 'permissions' && (
        <PermissionsView
          permissions={getStoredUrlParam('permissions')?.split(',') || []}
          selectedContext=""
          selectedIdentity=""
          onComplete={handlePermissionsApprove}
          onBack={() => setStep('manifest')}
        />
      )}

      {step === 'context-selection' && mode === 'multi-context' && (
        <ContextSelector
          onComplete={(contextId, identity) => generateAndRedirect(contextId, identity)}
          onBack={() => setStep('permissions')}
        />
      )}
    </>
  );
};

