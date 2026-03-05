import React, { useMemo, useState } from 'react';
import { getMero, getAppEndpointKey } from '../lib/mero';
import { ApplicationInstallCheck } from '../components/applications/ApplicationInstallCheck';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ContextSelector } from '../components/context/ContextSelector';
import { ErrorView } from '../components/common/ErrorView';
import { AppMode } from '../types/flows';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';
import { normalizePermissions } from '../utils/permissions';

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

  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    const rawPermissions = permissionsParam ? permissionsParam.split(',') : [];
    return normalizePermissions(mode, rawPermissions);
  }, [mode]);

  const handleAppCheckComplete = () => {
    setStep('permissions');
  };

  const handlePermissionsApprove = async () => {
    // Single-context mode requires context selection (user picks ONE context)
    // Multi-context mode skips selection (app manages contexts itself)
    if (mode === 'single-context') {
      setStep('context-selection');
    } else {
      // Multi-context mode: generate token immediately (no context selection)
      await generateAndRedirect(null, null);
    }
  };

  const generateAndRedirect = async (contextId: string | null, identity: string | null) => {
    try {
      const mero = getMero();
      const response = await mero.auth.generateClientKey({
        contextId: contextId || '',
        contextIdentity: identity || '',
        permissions,
      });

      // Cast response to access tokens
      const responseAny = response as any;

      if (responseAny.access_token && responseAny.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (!callback) {
          setError('Missing callback URL');
          return;
        }

        const returnUrl = new URL(callback);
        const fragmentParams = new URLSearchParams();
        fragmentParams.set('access_token', responseAny.access_token);
        fragmentParams.set('refresh_token', responseAny.refresh_token);
        
        // Include context_id so the client app knows which context to use
        if (contextId) {
          fragmentParams.set('context_id', contextId);
        }
        
        // Include identity so the client app knows which executor to use
        if (identity) {
          fragmentParams.set('context_identity', identity);
        }

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
          permissions={permissions}
          selectedContext=""
          selectedIdentity=""
          mode={mode}
          onComplete={handlePermissionsApprove}
          onBack={() => setStep('app-check')}
        />
      )}

      {step === 'context-selection' && mode === 'single-context' && (
        <ContextSelector
          onComplete={(contextId, identity) => generateAndRedirect(contextId, identity)}
          onBack={() => setStep('permissions')}
        />
      )}
    </>
  );
};

