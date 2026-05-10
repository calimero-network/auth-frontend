import React, { useMemo, useState } from 'react';
import { generateClientKeyDirect } from '../lib/mero';
import { ApplicationInstallCheck } from '../components/applications/ApplicationInstallCheck';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ErrorView } from '../components/common/ErrorView';
import Loader from '../components/common/Loader';
import { AppMode } from '../types/flows';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';
import { normalizePermissions } from '../utils/permissions';

interface ApplicationFlowProps {
  mode: AppMode;
  applicationId: string;
  applicationPath: string;
}

type Step = 'app-check' | 'permissions';

/**
 * ApplicationFlow - Handles legacy application-id based token generation
 *
 * Flow:
 * 1. Check if app is installed, install if needed
 * 2. Review permissions
 * 3. Generate scoped token and redirect (context selection handled by the app)
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
    await generateAndRedirect(null, null);
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
        if (!callback) {
          setError('Missing callback URL');
          setGenerating(false);
          return;
        }

        const returnUrl = new URL(callback);
        const fragmentParams = new URLSearchParams();
        fragmentParams.set('access_token', response.access_token);
        fragmentParams.set('refresh_token', response.refresh_token);

        if (contextId) {
          fragmentParams.set('context_id', contextId);
        }
        if (identity) {
          fragmentParams.set('context_identity', identity);
        }

        fragmentParams.set('node_url', window.location.origin);

        clearStoredUrlParams();
        window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
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
        onBack={() => window.history.back()}
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

    </>
  );
};
