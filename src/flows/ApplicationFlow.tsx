import React, { useMemo, useState } from 'react';
import { generateClientKeyDirect } from '../lib/mero';
import { redirectTokensToCallback } from '../utils/callbackUrl';
import { ApplicationInstallCheck } from '../components/applications/ApplicationInstallCheck';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ContextSelector } from '../components/context/ContextSelector';
import { ErrorView } from '../components/common/ErrorView';
import Loader from '../components/common/Loader';
import { AppMode } from '../types/flows';
import { getStoredUrlParam } from '../utils/urlParams';
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
 * 3. Select context (if single-context mode)
 * 4. Generate scoped token and redirect
 */
export const ApplicationFlow: React.FC<ApplicationFlowProps> = ({
  mode,
  applicationId,
  applicationPath
}) => {
  const [step, setStep] = useState<Step>('app-check');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    const rawPermissions = permissionsParam ? permissionsParam.split(',') : [];
    return normalizePermissions(mode, rawPermissions);
  }, [mode]);

  const handleAppCheckComplete = () => {
    setStep('permissions');
  };

  const handlePermissionsApprove = async () => {
    if (mode === 'single-context') {
      setStep('context-selection');
    } else {
      await generateAndRedirect(null, null);
    }
  };

  const generateAndRedirect = async (contextId: string | null, identity: string | null) => {
    setGenerating(true);
    try {
      const response = await generateClientKeyDirect({
        context_id: contextId || '',
        context_identity: identity || '',
        permissions,
      });

      if (response.access_token && response.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        const outcome = await redirectTokensToCallback(callback, response, {
          context_id: contextId,
          context_identity: identity,
        });
        if (outcome !== 'ok') {
          setError(
            outcome === 'missing'
              ? 'Missing callback URL'
              : 'Login callback destination is not allowed.',
          );
          setGenerating(false);
          return;
        }
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
          setStep('app-check');
        }}
      />
    );
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
