import React, { useState, useCallback, useEffect } from 'react';
import ProviderSelector from '../providers/ProviderSelector';
import { ContextSelector } from '../context/ContextSelector';
import { UsernamePasswordForm } from './UsernamePasswordForm';
import { NetworkId, setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { Buffer } from 'buffer';
import { handleUrlParams, getStoredUrlParam, clearStoredUrlParams } from '../../utils/urlParams';
import { apiClient, clearAccessToken, clearRefreshToken, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from '@calimero-network/calimero-client';
import { Provider } from '@calimero-network/calimero-client/lib/api/authApi';
import { ErrorView } from '../common/ErrorView';
import { SessionPrompt } from '../session/SessionPrompt';
import Loader from '../common/Loader';
import { PermissionsView } from '../permissions/PermissionsView';

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
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [showPermissionsView, setShowPermissionsView] = useState(false);
  const [showUsernamePasswordForm, setShowUsernamePasswordForm] = useState(false);
  const [usernamePasswordLoading, setUsernamePasswordLoading] = useState(false);
  const [cameFromUsernamePassword, setCameFromUsernamePassword] = useState(false);

  // Load providers
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

  const checkExistingSession = async () => {
    const existingAccessToken = getAccessToken();
    const existingRefreshToken = getRefreshToken();
    
    if (existingAccessToken && existingRefreshToken) {
      checkIfTokenIsValid(existingAccessToken, existingRefreshToken);
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
  
  const handleContinueSession = () => {
    console.log('handleContinueSession');
    // Check if admin permissions are requested
    const permissionsParam = getStoredUrlParam('permissions');
    const permissions = permissionsParam ? permissionsParam.split(',') : [];
    const hasAdminPermissions = permissions.includes('admin');
    
    if (hasAdminPermissions) {
      setShowPermissionsView(true);
    } else {
      setShowContextSelector(true);
    }
  };

  const handleNewLogin = async () => {
    await loadProviders();
    setShowProviders(true);
  };

  const handleUsernamePasswordAuth = async (username: string, password: string) => {
    try {
      setUsernamePasswordLoading(true);
      setError(null);

      const tokenPayload = {
        auth_method: 'user_password',
        public_key: username, // Use username as public key for user_password provider
        client_name: 'Calimero Auth Server',
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
          setShowContextSelector(true);
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
          client_name: 'Calimero Auth Server',
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
          
          // Check if admin permissions are requested
          const permissionsParam = getStoredUrlParam('permissions');
          const permissions = permissionsParam ? permissionsParam.split(',') : [];
          const hasAdminPermissions = permissions.includes('admin');

          console.log('hasAdminPermissions', hasAdminPermissions);
          
          if (hasAdminPermissions) {
            setShowPermissionsView(true);
          } else {
            setShowContextSelector(true);
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

  const handleAdminClientKeyGeneration = async (permissions: string[]) => {
    try {
      const response = await apiClient.auth().generateClientKey({
        context_id: '', // Admin permissions don't require specific context
        context_identity: '', // Admin permissions don't require specific identity
        permissions
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data.access_token && response.data.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (callback) {
          const returnUrl = new URL(callback);
          returnUrl.searchParams.set('access_token', response.data.access_token);
          returnUrl.searchParams.set('refresh_token', response.data.refresh_token);
          
          clearStoredUrlParams();
          window.location.href = returnUrl.toString();
        }
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate admin client key:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate admin client key');
    }
  };

  const handleContextAndIdentitySelect = async (contextId: string, identity: string) => {

    try {
      let permissions: string[] = [];
      const permissionsParam = getStoredUrlParam('permissions');
      if (permissionsParam) {
        permissions = permissionsParam.split(',');
      }

      const response = await apiClient.auth().generateClientKey({
        context_id: contextId,
        context_identity: identity,
        permissions
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data.access_token && response.data.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (callback) {
          const returnUrl = new URL(callback);
          returnUrl.searchParams.set('access_token', response.data.access_token);
          returnUrl.searchParams.set('refresh_token', response.data.refresh_token);
          
          clearStoredUrlParams();
          window.location.href = returnUrl.toString();
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

  const handleBack = () => {
    setShowContextSelector(false);
    if (cameFromUsernamePassword) {
      setShowUsernamePasswordForm(true);
      setCameFromUsernamePassword(false);
    } else {
      checkExistingSession();
    }
  };

  return (
    <>
      {!loading && !showProviders && !showContextSelector && !showPermissionsView && !showUsernamePasswordForm && getAccessToken() && getRefreshToken() && (
        <SessionPrompt
          onContinueSession={handleContinueSession}
          onStartNewSession={handleNewLogin}
        />
      )}

      {showProviders && !showContextSelector && (
        <ProviderSelector
          providers={providers}
          onProviderSelect={handleProviderSelect}
          loading={loading}
          hasExistingSession={!!(getAccessToken() && getRefreshToken())}
          onBack={() => {
            setShowProviders(false);
            checkExistingSession();
          }}
        />
      )}

      {showContextSelector && (
        <ContextSelector
          onComplete={(contextId, identity) => handleContextAndIdentitySelect(contextId, identity)}
          onBack={handleBack}
        />
      )}

      {showPermissionsView && (
        <PermissionsView
          permissions={getStoredUrlParam('permissions')?.split(',') || []}
          selectedContext="admin"
          selectedIdentity="admin"
          onComplete={async () => {
            const permissionsParam = getStoredUrlParam('permissions');
            const permissions = permissionsParam ? permissionsParam.split(',') : [];
            await handleAdminClientKeyGeneration(permissions);
          }}
          onBack={() => {
            setShowPermissionsView(false);
            if (cameFromUsernamePassword) {
              setShowUsernamePasswordForm(true);
              setCameFromUsernamePassword(false);
            } else {
              checkExistingSession();
            }
          }}
        />
      )}

      {showUsernamePasswordForm && (
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