import React, { useMemo, useState } from 'react';
import { generateClientKeyDirect } from '../lib/mero';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ErrorView } from '../components/common/ErrorView';
import Loader from '../components/common/Loader';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';
import { normalizePermissions } from '../utils/permissions';

/**
 * AdminFlow - Handles admin token generation
 *
 * Flow:
 * 1. Review admin permissions
 * 2. Generate admin-scoped client key
 * 3. Redirect to callback with tokens
 */
export const AdminFlow: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    const rawPermissions = permissionsParam ? permissionsParam.split(',') : [];
    return normalizePermissions('admin', rawPermissions);
  }, []);

  const handlePermissionsApprove = async () => {
    setGenerating(true);
    try {
      const response = await generateClientKeyDirect({
        context_id: '',
        context_identity: '',
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

        clearStoredUrlParams();
        window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate admin token:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate admin token');
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
        onRetry={() => setError(null)}
      />
    );
  }

  return (
    <PermissionsView
      permissions={permissions}
      selectedContext=""
      selectedIdentity=""
      mode="admin"
      onComplete={handlePermissionsApprove}
      onBack={() => window.history.back()}
    />
  );
};
