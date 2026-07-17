import React, { useState, useCallback, useEffect } from 'react';
import ProviderSelector from '../providers/ProviderSelector';
import { handleUrlParams, getStoredUrlParam } from '../../utils/urlParams';
import { resolveTrustedCallbackUrl, redirectTokensToCallback } from '../../utils/callbackUrl';
import {
  getMero,
  generateClientKeyDirect,
  hasLiveSession,
  isAuthRevoked,
  setTokens,
  clearTokens,
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
   * Returns true on success so callers can avoid rendering the provider list
   * (and its misleading "No providers available" empty state) when the
   * request itself failed — e.g. the node is unreachable.
   */
  const loadProviders = useCallback(async (): Promise<boolean> => {
    try {
      const mero = getMero();
      const response: any = await mero.auth.getProviders();
      setProviders((response as any)?.data?.providers ?? (response as any)?.providers ?? []);
      return true;
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load authentication providers');
      return false;
    }
  }, []);

  /**
   * Auto-continue flow bootstrap.
   * If a live root session exists, skip providers and show next screen (permissions/install) based on URL permissions.
   * Otherwise, show providers and load provider list.
   *
   * The session check is read-only (HEAD /auth/validate). It used to be a
   * POST /auth/refresh, which since core#3083 consumes a single-use refresh
   * token on every mount — and which the node rejects outright while the
   * access token is still valid, so it never worked as a liveness check
   * either. mero-js refreshes on its own when a real request comes back 401
   * `token_expired`, and now persists the rotated bundle.
   */
  const checkExistingSession = async () => {
    // Don't bypass authentication for manifest flows - let user authenticate first.
    // The manifest processing will happen after authentication.
    if (await hasLiveSession()) {
      setShowProviders(false);

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
      // Whatever is left is unusable (a revoked family included) — drop it and
      // authenticate again.
      clearTokens();
      const loaded = await loadProviders();
      setShowProviders(loaded);
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
    const loaded = await loadProviders();
    setShowProviders(loaded);
  };

  /**
   * A revoked token family (core#3083) is terminal — no retry can fix it. Drop
   * the session and send the user back to the provider screen rather than park
   * them on an error whose Retry button can only fail again.
   *
   * @returns true when the error was a revocation and has been handled
   */
  const handleRevokedSession = async (err: unknown): Promise<boolean> => {
    if (!isAuthRevoked(err)) return false;

    clearTokens();
    setShowPermissionsView(false);
    setShowApplicationInstallCheck(false);
    setShowManifestProcessor(false);
    setShowUsernamePasswordForm(false);
    setError(null);
    setShowProviders(await loadProviders());
    return true;
  };

  /**
   * Handle username/password authentication flow.
   * Exchanges credentials for a root token, then routes to permissions or install check.
   *
   * This is always a plain existing-user login: since core rc.17 the login
   * path never mints keys — the node's admin account is provisioned at
   * `merod init` (or via `merod auth set-admin`), so there is no first-login
   * setup code to collect or send.
   *
   * @param username - Provided username
   * @param password - Provided password
   */
  const handleUsernamePasswordAuth = async (
    username: string,
    password: string,
  ) => {
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
        // MeroJs takes ownership of the bundle and persists it — and every
        // rotation it performs later — through the token store.
        setTokens({
          access_token: (tokenResponse as any).data.access_token,
          refresh_token: (tokenResponse as any).data.refresh_token,
        });

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
      if (!(await handleRevokedSession(err))) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setUsernamePasswordLoading(false);
    }
  };

  /**
   * Handle provider selection.
   * For user_password, shows the credential form. Every other provider is
   * unsupported: the wallet path this used to run needed GET /auth/challenge,
   * which core#3229 removes (there is no wallet provider to sign for).
   *
   * @param provider - Selected auth provider metadata
   */
  const handleProviderSelect = async (provider: Provider) => {
    if (provider.name === 'user_password') {
      setShowProviders(false);
      setShowUsernamePasswordForm(true);
      return;
    }

    setError(`Provider ${provider.name} is not supported`);
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
        const outcome = await redirectTokensToCallback(callback, response, {
          application_id: localStorage.getItem('installed-application-id'),
        });
        if (outcome !== 'ok') {
          setError(
            outcome === 'missing'
              ? 'Missing callback URL'
              : 'Login callback destination is not allowed.',
          );
          return;
        }
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate admin client key:', err);
      if (!(await handleRevokedSession(err))) {
        setError(err instanceof Error ? err.message : 'Failed to generate admin client key');
      }
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

      // Pass the requested permissions through unscoped. Do NOT rewrite them to
      // `context:*[<application-id>]`: core's permission model treats bracket
      // params on context permissions as context ids, and its path-based route
      // mappings require Global scope for `POST /jsonrpc` (context:execute) and
      // `GET/POST /admin-api/contexts` (context:list / context:create). Since
      // core 0.11.0-rc.9 enforces token scopes (default-deny on /admin-api/*),
      // an application-id-scoped token is rejected with 403 on all of those
      // routes, which locks every app in a redirect-back-to-login loop.

      const response = await generateClientKeyDirect({
        context_id: contextId || '',
        context_identity: identity || '',
        permissions,
      });

      if (response.access_token && response.refresh_token) {
        const callback = getStoredUrlParam('callback-url');
        // Capture the app id before the shared handoff clears/redirects.
        const installedAppIdForRedirect = localStorage.getItem('installed-application-id');
        if (!(await resolveTrustedCallbackUrl(callback))) {
          setError(
            callback
              ? 'Login callback destination is not allowed.'
              : 'Missing callback URL',
          );
          return;
        }
        localStorage.removeItem('installed-application-id');
        await redirectTokensToCallback(callback, response, {
          application_id: installedAppIdForRedirect,
        });
      } else {
        throw new Error('Failed to generate client key');
      }
    } catch (err) {
      console.error('Failed to generate client key:', err);
      if (!(await handleRevokedSession(err))) {
        setError(err instanceof Error ? err.message : 'Failed to generate client key');
      }
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
          onRetry={loadProviders}
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