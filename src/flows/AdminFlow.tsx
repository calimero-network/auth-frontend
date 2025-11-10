import React, { useMemo, useState } from 'react';
import { apiClient, getAppEndpointKey } from '@calimero-network/calimero-client';
import { PermissionsView } from '../components/permissions/PermissionsView';
import { ErrorView } from '../components/common/ErrorView';
import { clearStoredUrlParams, getStoredUrlParam } from '../utils/urlParams';
import { normalizePermissions } from '../utils/permissions';

/**
 * AdminFlow - Handles admin token generation
 * 
 * Flow:
 * 1. Review admin permissions
 * 2. Generate admin-scoped client key
 * 3. Redirect to callback with tokens
 * 
 * No app installation, no context selection required.
 */
export const AdminFlow: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    const rawPermissions = permissionsParam ? permissionsParam.split(',') : [];
    return normalizePermissions('admin', rawPermissions);
  }, []);

  const handlePermissionsApprove = async () => {
    try {
      const response = await apiClient.auth().generateClientKey({
        context_id: '',
        context_identity: '',
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
      console.error('Failed to generate admin token:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate admin token');
    }
  };

  if (error) {
    return <ErrorView message={error} onRetry={() => window.location.reload()} />;
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




