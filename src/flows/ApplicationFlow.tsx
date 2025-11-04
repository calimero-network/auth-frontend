import React, { useState } from 'react';
import { apiClient, getAppEndpointKey } from '@calimero-network/calimero-client';
import { ApplicationInstallCheck } from '../components/applications/ApplicationInstallCheck';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ContextSelector } from '../components/context/ContextSelector';
import { ErrorView } from '../components/common/ErrorView';
import { AppMode } from '../types/flows';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';

interface ApplicationFlowProps {
  mode: AppMode;
  applicationId: string;
  applicationPath: string;
}

type Step = 'app-check' | 'permissions' | 'context-selection' | 'complete';

/**
 * ApplicationFlow - Handles legacy application-id based token generation
 * 
 * Flow:
 * 1. Check if app is installed, install if needed
 * 2. Review permissions
 * 3. Select context (if multi-context mode)
 * 4. Generate scoped token and redirect
 */
export const ApplicationFlow: React.FC<ApplicationFlowProps> = ({
  mode,
  applicationId,
  applicationPath
}) => {
  const [step, setStep] = useState<Step>('app-check');
  const [error, setError] = useState<string | null>(null);

  const handleAppCheckComplete = () => {
    setStep('permissions');
  };

  const handlePermissionsApprove = async () => {
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
      const permissions = permissionsParam ? permissionsParam.split(',') : [];

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
      {step === 'app-check' && (
        <ApplicationInstallCheck
          onComplete={handleAppCheckComplete}
          onBack={() => window.history.back()}
        />
      )}

      {step === 'permissions' && (
        <PermissionsView
          permissions={getStoredUrlParam('permissions')?.split(',') || []}
          selectedContext=""
          selectedIdentity=""
          onComplete={handlePermissionsApprove}
          onBack={() => setStep('app-check')}
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

