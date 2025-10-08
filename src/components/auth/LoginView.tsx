import React, { useState, useCallback, useEffect } from 'react';
import ProviderSelector from '../providers/ProviderSelector';
import { NetworkId, setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { Buffer } from 'buffer';
import { handleUrlParams, getStoredUrlParam, clearStoredUrlParams } from '../../utils/urlParams';
import { apiClient, clearAccessToken, clearRefreshToken, getAccessToken, getAppEndpointKey, getRefreshToken, setAccessToken, setRefreshToken } from '@calimero-network/calimero-client';
import { Provider } from '@calimero-network/calimero-client/lib/api/authApi';
import { ErrorView } from '../common/ErrorView';
import Loader from '../common/Loader';
import { PermissionsView } from '../permissions/PermissionsView';
import { UsernamePasswordForm } from './UsernamePasswordForm';
import { ApplicationInstallCheck } from '../applications/ApplicationInstallCheck';

interface SignedMessage {
  accountId: string;
  publicKey: string;
  signature: string;
}

const LoginView: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(false);
  const [showApplicationInstallCheck, setShowApplicationInstallCheck] = useState(false);
  const [showPermissionsView, setShowPermissionsView] = useState(false);
  const [showUsernamePasswordForm, setShowUsernamePasswordForm] = useState(false);
  const [usernamePasswordLoading, setUsernamePasswordLoading] = useState(false);
  const [cameFromUsernamePassword, setCameFromUsernamePassword] = useState(false);
  const [cameFromApplicationCheck, setCameFromApplicationCheck] = useState(false);

  /**
   * Load available authentication providers from the auth service and update UI state.
   * Used when showing the provider selector or after an invalid/cleared session.
   */
  const loadProviders = useCallback(async () => {
    try {
      const availableProviders = await apiClient.auth().getProviders();

      if (availableProviders.error) {
        setError(availableProviders.error.message);
        return;
      }

      setProviders(availableProviders.data.providers);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError('Failed to load authentication providers');
    }
  }, []);

  /**
   * Validate or refresh an existing root token pair.
   *
   * @param accessToken - Current access token
   * @param refreshToken - Current refresh token
   * @returns Promise resolving to true when session remains valid (possibly rotated), false otherwise
   */
  const checkIfTokenIsValid = async (accessToken: string, refreshToken: string) => {
    try {
      const response = await apiClient.auth().refreshToken({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (response.error?.message?.includes('Access token still valid')) {
        setShowProviders(false);
        return true;
      }

      if (response.data?.access_token && response.data?.refresh_token) {
        setAccessToken(response.data.access_token);
        setRefreshToken(response.data.refresh_token)
        setShowProviders(false);
        return true;
      }

      throw new Error(response.error?.message || 'Failed to validate token');
    } catch (err) {
      console.error('Token validation failed:', err);
      clearAccessToken();
      clearRefreshToken();
      setShowProviders(true);
      await loadProviders();
      return false;
    }
  };

  /**
   * Auto-continue flow bootstrap.
   * If a valid root token exists, skip providers and show next screen (permissions/install) based on URL permissions.
   * Otherwise, show providers and load provider list.
   */
  const checkExistingSession = async () => {
    const existingAccessToken = getAccessToken();
    const existingRefreshToken = getRefreshToken();
    
    if (existingAccessToken && existingRefreshToken) {
      const isValid = await checkIfTokenIsValid(existingAccessToken, existingRefreshToken);
      if (isValid) {
        // Automatically continue session and check permissions
        const permissionsParam = getStoredUrlParam('permissions');
        const permissions = permissionsParam ? permissionsParam.split(',') : [];
        const hasAdminPermissions = permissions.includes('admin');
        
        if (hasAdminPermissions) {
          setShowPermissionsView(true);
        } else {
          setShowApplicationInstallCheck(true);
        }
      } else {
        setShowProviders(true);
        await loadProviders();
      }
    } else {
      setShowProviders(true);
      await loadProviders();
    }
    setLoading(false);
  };
  
  useEffect(() => {
    handleUrlParams();
    
    const callback = getStoredUrlParam('callback-url');
    if (!callback) {
      setError('Missing required callback URL parameter');
      setLoading(false);
      return;
    }
    
    checkExistingSession();
  }, []);
  
  /**
   * Explicit continue handler when returning from nested views.
   * Decides whether to show permissions or application install check based on requested permissions.
   */
  const handleContinueSession = () => {
    console.log('handleContinueSession');
    // Check if admin permissions are requested
    const permissionsParam = getStoredUrlParam('permissions');
    const permissions = permissionsParam ? permissionsParam.split(',') : [];
    const hasAdminPermissions = permissions.includes('admin');
    
    if (hasAdminPermissions) {
      setShowPermissionsView(true);
    } else {
      setShowApplicationInstallCheck(true);
    }
  };

  /**
   * Force showing providers and reloading available providers (used when restarting login).
   */
  const handleNewLogin = async () => {
    await loadProviders();
    setShowProviders(true);
  };

  /**
   * Handle username/password authentication flow.
   * Exchanges credentials for a root token, then routes to permissions or install check.
   *
   * @param username - Provided username
   * @param password - Provided password
   */
  const handleUsernamePasswordAuth = async (username: string, password: string) => {
    try {
      setUsernamePasswordLoading(true);
      setError(null);

      const tokenPayload = {
        auth_method: 'user_password',
        public_key: username, // Use username as public key for user_password provider
        client_name: window.location.href,
        timestamp: Date.now(),
        permissions: [],
        provider_data: {
          username: username,
          password: password
        }
      };

      const tokenResponse = await apiClient.auth().requestToken(tokenPayload);

      if (tokenResponse.error) {
        setError(tokenResponse.error.message);
        return;
      }

      if (tokenResponse.data.access_token && tokenResponse.data.refresh_token) {
        setAccessToken(tokenResponse.data.access_token);
        setRefreshToken(tokenResponse.data.refresh_token);
        
        // Check if admin permissions are requested
        const permissionsParam = getStoredUrlParam('permissions');
        const permissions = permissionsParam ? permissionsParam.split(',') : [];
        const hasAdminPermissions = permissions.includes('admin');

        if (hasAdminPermissions) {
          setShowPermissionsView(true);
          setShowUsernamePasswordForm(false);
          setCameFromUsernamePassword(true);
        } else {
          setShowApplicationInstallCheck(true);
          setShowUsernamePasswordForm(false);
          setCameFromUsernamePassword(true);
        }
      } else {
        throw new Error('Failed to get access token');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setUsernamePasswordLoading(false);
    }
  };

  /**
   * Handle provider selection.
   * For near_wallet, performs challenge → sign → token exchange; for user_password, shows the credential form.
   * Routes to permissions or application install check after a successful root token exchange.
   *
   * @param provider - Selected auth provider metadata
   */
  const handleProviderSelect = async (provider: Provider) => {
    try {
      if (provider.name === 'near_wallet') {
        const challengeResponse = await apiClient.auth().getChallenge();

        if (challengeResponse.error) {
          setError(challengeResponse.error.message);
          return;
        }
        
        const selector = await setupWalletSelector({
          network: provider.config?.network as NetworkId,
          modules: [setupMyNearWallet()]
        });

        const wallet = await selector.wallet('my-near-wallet');
        
        let signature;
        try {
          signature = await wallet.signMessage({
            message: challengeResponse.data.challenge,
            nonce: Buffer.from(challengeResponse.data.nonce, 'base64'),
            recipient: 'calimero',
            callbackUrl: window.location.href
          }) as SignedMessage;
        } catch (err) {
          // Handle user closing the window
          if (err instanceof Error && err.message === 'User closed the window') {
            setShowProviders(true);
            return;
          }
          throw err;
        }

        const tokenPayload = {
          auth_method: provider.name,
          public_key: signature.publicKey,
          client_name: window.location.href,
          timestamp: Date.now(),
          permissions: [],
          provider_data: {
            wallet_address: signature.accountId,
            message: challengeResponse.data.challenge,
            signature: signature.signature,
            recipient: 'calimero'
          }
        };

        const tokenResponse = await apiClient.auth().requestToken(tokenPayload);

        if (tokenResponse.error) {
          setError(tokenResponse.error.message);
          return;
        }

        if (tokenResponse.data.access_token && tokenResponse.data.refresh_token) {
          setAccessToken(tokenResponse.data.access_token);
          setRefreshToken(tokenResponse.data.refresh_token);
          
          const permissionsParam = getStoredUrlParam('permissions');
          const permissions = permissionsParam ? permissionsParam.split(',') : [];
          const hasAdminPermissions = permissions.includes('admin');
          
          if (hasAdminPermissions) {
            setShowPermissionsView(true);
          } else {
            setShowApplicationInstallCheck(true);
          }
        } else {
          throw new Error('Failed to get access token');
        }
      } else if (provider.name === 'user_password') {
        setShowProviders(false);
        setShowUsernamePasswordForm(true);
      } else {
        setError(`Provider ${provider.name} is not implemented yet`);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };  

  /**
   * Generate an admin-scoped client key and redirect back to callback with tokens in the URL fragment.
   *
   * @param permissions - Requested permissions set (includes 'admin')
   */
  const handleAdminClientKeyGeneration = async (permissions: string[]) => {
    try {
      const response = await apiClient.auth().generateClientKey({
        context_id: '', // Admin permissions don't require specific context
        context_identity: '', // Admin permissions don't require specific identity
        permissions,
        target_node_url: getAppEndpointKey() || ''
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data.access_token && response.data.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (callback) {
          const returnUrl = new URL(callback);
          // Create fragment params for tokens
          const fragmentParams = new URLSearchParams();
          fragmentParams.set('access_token', response.data.access_token);
          fragmentParams.set('refresh_token', response.data.refresh_token);
          
          clearStoredUrlParams();
          // Combine the base URL with the fragment
          window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
        }
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate admin client key:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate admin client key');
    }
  };

  /**
   * Transition handler after application install flow completes; advances to permissions view.
   */
  const handleApplicationInstallComplete = () => {
    setShowApplicationInstallCheck(false);
    setShowPermissionsView(true);
    setCameFromApplicationCheck(true);
  };

  /**
   * Generate a context/application-scoped client key and redirect back to callback with tokens.
   *
   * @param contextId - Selected context ID (empty for application token)
   * @param identity - Selected identity/public key within the context (optional)
   */
  const handleContextAndIdentitySelect = async (contextId?: string, identity?: string) => {

    try {
      let permissions: string[] = [];
      const permissionsParam = getStoredUrlParam('permissions');
      if (permissionsParam) {
        permissions = permissionsParam.split(',');
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
        if (callback) {
          const returnUrl = new URL(callback);
          // Create fragment params for tokens
          const fragmentParams = new URLSearchParams();
          fragmentParams.set('access_token', response.data.access_token);
          fragmentParams.set('refresh_token', response.data.refresh_token);
          
          clearStoredUrlParams();
          // Combine the base URL with the fragment
          window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
        }
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate client key:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate client key');
    }
  };
  
  if (loading) {
    return (
      <Loader />
    );
  }

  if (error) {
    return (
      <>
        <ErrorView 
          message={error} 
          onRetry={() => {
            setError(null);
            window.location.reload();
          }} 
          buttonText="Reload Page"
        />
        {error === 'Missing required callback URL parameter' && (
          <p style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
            Please provide a callback URL in the query parameters (e.g., ?callback=your_url or ?redirect_uri=your_url)
          </p>
        )}
      </>
    );
  }

  /**
   * Generic back navigation handler restoring prior subview or re-evaluating session to determine the next screen.
   */
  const handleBack = () => {
    setShowApplicationInstallCheck(false);
    if (cameFromUsernamePassword) {
      setShowUsernamePasswordForm(true);
      setCameFromUsernamePassword(false);
    } else {
      checkExistingSession();
    }
  };

  return (
    <>
      {loading && <Loader />}

      {showProviders && !showApplicationInstallCheck && !showPermissionsView && (
        <ProviderSelector
          providers={providers}
          onProviderSelect={handleProviderSelect}
          loading={loading}
        />
      )}

      {showApplicationInstallCheck && !showPermissionsView && (
        <ApplicationInstallCheck
          onComplete={handleApplicationInstallComplete}
          onBack={() => {
            setShowApplicationInstallCheck(false);
            if (cameFromUsernamePassword) {
              setShowUsernamePasswordForm(true);
              setCameFromUsernamePassword(false);
            } else {
              checkExistingSession();
            }
          }}
        />
      )}

      {showPermissionsView && (
        <PermissionsView
          permissions={getStoredUrlParam('permissions')?.split(',') || []}
          selectedContext=""
          selectedIdentity=""
          onComplete={handleContextAndIdentitySelect}
          onBack={() => {
            setShowPermissionsView(false);
            if (cameFromApplicationCheck) {
              setShowApplicationInstallCheck(true);
              setCameFromApplicationCheck(false);
            } else if (cameFromUsernamePassword) {
              setShowUsernamePasswordForm(true);
              setCameFromUsernamePassword(false);
            } else {
              checkExistingSession();
            }
          }}
        />
      )}

      {showUsernamePasswordForm && !showPermissionsView && !showApplicationInstallCheck && (
        <UsernamePasswordForm
          onBack={() => {
            setShowUsernamePasswordForm(false);
            setShowProviders(true);
            setError(null);
            setUsernamePasswordLoading(false);
            setCameFromUsernamePassword(false);
          }}
          onSubmit={handleUsernamePasswordAuth}
          loading={usernamePasswordLoading}
          error={error}
        />
      )}
    </>
  );
};

export default LoginView;