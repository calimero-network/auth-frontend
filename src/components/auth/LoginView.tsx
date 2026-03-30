import React, { useState, useCallback, useEffect } from 'react';
import ProviderSelector from '../providers/ProviderSelector';
import { NetworkId, setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { Buffer } from 'buffer';
import { handleUrlParams, getStoredUrlParam, clearStoredUrlParams } from '../../utils/urlParams';
import {
  getMero,
  generateClientKeyDirect,
  clearAccessToken,
  clearRefreshToken,
  getAccessToken,
  getAppEndpointKey,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  extractTokens
} from '../../lib/mero';
interface Provider { name: string; type: string; description?: string; configured?: boolean; config?: Record<string, unknown>; [key: string]: unknown; }
import { ErrorView } from '../common/ErrorView';
import Loader from '../common/Loader';
import { PermissionsView } from '../permissions/PermissionsView';
import { UsernamePasswordForm } from './UsernamePasswordForm';
import { ApplicationInstallCheck } from '../applications/ApplicationInstallCheck';
import { ManifestProcessor } from '../manifest';
import { normalizePermissions } from '../../utils/permissions';
import { AppMode } from '../../types/flows';

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
  const [showManifestProcessor, setShowManifestProcessor] = useState(false);

  // Store URL params in state (read once on mount)
  const [packageName] = useState(() => new URLSearchParams(window.location.search).get('package-name'));
  const [packageVersion] = useState(() => new URLSearchParams(window.location.search).get('package-version'));
  const [registryUrl] = useState(() => new URLSearchParams(window.location.search).get('registry-url'));

  /**
   * Load available authentication providers from the auth service and update UI state.
   * Used when showing the provider selector or after an invalid/cleared session.
   */
  const loadProviders = useCallback(async () => {
    try {
      const mero = getMero();
      const response: any = await mero.auth.getProviders();
      setProviders((response as any)?.data?.providers ?? (response as any)?.providers ?? []);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load authentication providers');
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
      const mero = getMero();
      const response: any = await mero.auth.refreshToken({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if ((response as any).data.access_token && (response as any).data.refresh_token) {
        setAccessToken((response as any).data.access_token);
        setRefreshToken((response as any).data.refresh_token);
        setShowProviders(false);
        return true;
      }

      throw new Error('Failed to validate token');
    } catch (err) {
      // Check if error message indicates token is still valid
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('Access token still valid') || errorMessage.includes('token valid')) {
        setShowProviders(false);
        return true;
      }
      
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
    // Check for manifest-based flows first
    const manifestUrl = getStoredUrlParam('manifest-url');
    
    
    // Don't bypass authentication for manifest flows - let user authenticate first
    // The manifest processing will happen after authentication
    
    const existingAccessToken = getAccessToken();
    const existingRefreshToken = getRefreshToken();
    
    if (existingAccessToken && existingRefreshToken) {
      const isValid = await checkIfTokenIsValid(existingAccessToken, existingRefreshToken);
      if (isValid) {
        // Automatically continue session and check permissions
        const permissionsParam = getStoredUrlParam('permissions');
        const permissions = permissionsParam ? permissionsParam.split(',') : [];
        const hasAdminPermissions = permissions.includes('admin');
        
        // Check for manifest flows after authentication
        const manifestUrl = getStoredUrlParam('manifest-url');
        
        // For manifest flows, show permissions FIRST
        if (manifestUrl) {
          // Store manifest data for PermissionsView to display
          setShowPermissionsView(true);
        } else if (hasAdminPermissions) {
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
    
    // Check for manifest flow first - show permissions before manifest
    const manifestUrl = getStoredUrlParam('manifest-url');
    if (manifestUrl) {
      console.log('handleContinueSession: manifest-url found, showing PermissionsView first');
      setShowPermissionsView(true);
      return;
    }
    
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

      const mero = getMero();
      const tokenPayload = {
        auth_method: 'user_password' as const,
        public_key: username, // Use username as public key for user_password provider
        client_name: window.location.href,
        timestamp: Date.now(),
        permissions: [] as string[],
        provider_data: {
          username: username,
          password: password
        }
      };

      const tokenResponse = await mero.auth.generateTokens(tokenPayload) as any;

      if ((tokenResponse as any).data.access_token && (tokenResponse as any).data.refresh_token) {
        setAccessToken((tokenResponse as any).data.access_token);
        setRefreshToken((tokenResponse as any).data.refresh_token);
        
        // Check for manifest/package flows after authentication
        const manifestUrl = getStoredUrlParam('manifest-url');
        const packageName = getStoredUrlParam('package-name');
        
        // Manifest or package-name flows proceed directly to permissions
        if (manifestUrl || packageName) {
          setShowPermissionsView(true);
          setShowUsernamePasswordForm(false);
          setCameFromUsernamePassword(true);
        } else {
          // Legacy flow: check for admin permissions
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
      const mero = getMero();
      
      if (provider.name === 'near_wallet') {
        const challengeResponse = await mero.auth.getChallenge() as any;
        
        // Provider config may have network info - cast to any for flexibility
        const providerConfig = (provider as any).config;
        const selector = await setupWalletSelector({
          network: providerConfig?.network as NetworkId,
          modules: [setupMyNearWallet()]
        });

        const wallet = await selector.wallet('my-near-wallet');
        
        let signature;
        try {
          signature = await wallet.signMessage({
            message: (challengeResponse as any)?.data?.challenge ?? (challengeResponse as any)?.challenge,
            nonce: Buffer.from((challengeResponse as any)?.data?.challenge ?? (challengeResponse as any)?.challenge, 'base64'),
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
          auth_method: provider.name as 'near_wallet',
          public_key: signature.publicKey,
          client_name: window.location.href,
          timestamp: Date.now(),
          permissions: [] as string[],
          provider_data: {
            wallet_address: signature.accountId,
            message: (challengeResponse as any)?.data?.challenge ?? (challengeResponse as any)?.challenge,
            signature: signature.signature,
            recipient: 'calimero'
          }
        };

        const tokenResponse = await mero.auth.generateTokens(tokenPayload) as any;

        if ((tokenResponse as any).data.access_token && (tokenResponse as any).data.refresh_token) {
          setAccessToken((tokenResponse as any).data.access_token);
          setRefreshToken((tokenResponse as any).data.refresh_token);
          
          const permissionsParam = getStoredUrlParam('permissions');
          const permissions = permissionsParam ? permissionsParam.split(',') : [];
          const hasAdminPermissions = permissions.includes('admin');
          
          // Check for manifest flows after authentication
          const manifestUrl = getStoredUrlParam('manifest-url');
          
          // For manifest flows, we need admin permissions, so show PermissionsView first
          if (manifestUrl && hasAdminPermissions) {
            setShowPermissionsView(true);
          } else if (hasAdminPermissions) {
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
      const response = await generateClientKeyDirect({
        context_id: '',
        context_identity: '',
        permissions,
      });

      if (response.access_token && response.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (callback) {
          const returnUrl = new URL(callback);
          const fragmentParams = new URLSearchParams();
          fragmentParams.set('access_token', response.access_token);
          fragmentParams.set('refresh_token', response.refresh_token);

          // Include node URL so CalimeroProvider can set appEndpointKey
          const nodeUrl = getStoredUrlParam('app-url') || getAppEndpointKey();
          if (nodeUrl) {
            fragmentParams.set('node_url', nodeUrl);
          }

          // Include applicationId for package-based flows
          const installedAppId = localStorage.getItem('installed-application-id');
          if (installedAppId) {
            fragmentParams.set('application_id', installedAppId);
          }

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
   * Handle manifest processing completion.
   * After manifest is processed, proceed to package install flow.
   */
  // ManifestProcessor now handles installation inline - no need for separate flow


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

      // Scope permissions to the installed application ID if available
      const installedAppId = localStorage.getItem('installed-application-id');
      if (installedAppId) {
        console.log('Scoping permissions to application:', installedAppId);
        // Scope context permissions to the specific application
        permissions = permissions.map(perm => {
          // Only scope context permissions (context:create, context:list, context:execute)
          if (perm.startsWith('context:')) {
            return `${perm}[${installedAppId}]`;
          }
          return perm;
        });
        console.log('Application-scoped permissions:', permissions);
      }

      const response = await generateClientKeyDirect({
        context_id: contextId || '',
        context_identity: identity || '',
        permissions,
      });

      if (response.access_token && response.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        if (callback) {
          const returnUrl = new URL(callback);
          const fragmentParams = new URLSearchParams();
          fragmentParams.set('access_token', response.access_token);
          fragmentParams.set('refresh_token', response.refresh_token);

          // Include node URL so CalimeroProvider can set appEndpointKey
          const nodeUrl = getStoredUrlParam('app-url') || getAppEndpointKey();
          if (nodeUrl) {
            fragmentParams.set('node_url', nodeUrl);
          }

          // Include applicationId for package-based flows (before cleanup!)
          const installedAppIdForRedirect = localStorage.getItem('installed-application-id');
          if (installedAppIdForRedirect) {
            fragmentParams.set('application_id', installedAppIdForRedirect);
          } else {
            console.warn('❌ DEBUG: No installed-application-id in localStorage!');
          }
          
          
          // Clean up stored application ID
          localStorage.removeItem('installed-application-id');
          
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
    setShowManifestProcessor(false);
    if (cameFromUsernamePassword) {
      setShowUsernamePasswordForm(true);
      setCameFromUsernamePassword(false);
    } else {
      checkExistingSession();
    }
  };

  // Show loader when transitioning between steps (no view is active)
  const noViewActive =
    !loading &&
    !showProviders &&
    !showApplicationInstallCheck &&
    !showPermissionsView &&
    !showUsernamePasswordForm &&
    !showManifestProcessor;

  return (
    <>
      {loading && <Loader />}
      {noViewActive && <Loader />}

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
        (() => {
          const modeParam = (getStoredUrlParam('mode') || '') as AppMode;
          const rawPermissions = getStoredUrlParam('permissions')?.split(',') || [];
          const normalized = normalizePermissions(modeParam, rawPermissions);

          return (
        <PermissionsView
            permissions={normalized}
            selectedContext=""
            selectedIdentity=""
            mode={modeParam}
            onComplete={() => {
              setShowPermissionsView(false);
              
              // Check if this is a manifest flow (via manifest-url OR package-name)
              const manifestUrl = getStoredUrlParam('manifest-url');
              const packageName = getStoredUrlParam('package-name');
              
              if (manifestUrl || packageName) {
                // For manifest flows, show ManifestProcessor first
                setShowManifestProcessor(true);
              } else if (cameFromApplicationCheck) {
                // App is already installed and permissions approved — generate token and redirect
                setCameFromApplicationCheck(false);
                handleContextAndIdentitySelect();
              } else {
                checkExistingSession();
              }
            }}
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
          );
        })()
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

      {showManifestProcessor && !showPermissionsView && !showApplicationInstallCheck && (
        <>
          <ManifestProcessor
            onComplete={handleContextAndIdentitySelect}
            onBack={handleBack}
          />
        </>
      )}


    </>
  );
};

export default LoginView;