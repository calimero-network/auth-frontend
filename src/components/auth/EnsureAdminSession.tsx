import React, { useState, useCallback, useEffect } from 'react';
import {
  getMero,
  hasLiveSession,
  isAuthRevoked,
  setTokens,
  clearTokens,
} from '../../lib/mero';
interface Provider { name: string; type: string; description?: string; configured?: boolean; config?: Record<string, unknown>; [key: string]: unknown; }
import ProviderSelector from '../providers/ProviderSelector';
import { UsernamePasswordForm } from './UsernamePasswordForm';
import Loader from '../common/Loader';
import { ErrorView } from '../common/ErrorView';

interface EnsureAdminSessionProps {
  children: React.ReactNode;
  onReady?: () => void;
}

/**
 * EnsureAdminSession - Ensures auth-frontend has a valid admin token
 * 
 * Responsibilities:
 * - Check if valid admin token exists in localStorage
 * - If NO → Show provider selector → Authenticate → Store token
 * - If YES → Validate/refresh token → Render children
 * 
 * This is the ONLY component responsible for auth-frontend's self-authentication.
 * Once the admin token is secured, children (flow components) can use it to
 * generate scoped tokens for external apps.
 */
export const EnsureAdminSession: React.FC<EnsureAdminSessionProps> = ({ children, onReady }) => {
  const [hasAdminToken, setHasAdminToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(false);
  const [showUsernamePasswordForm, setShowUsernamePasswordForm] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [usernamePasswordLoading, setUsernamePasswordLoading] = useState(false);

  /**
   * Load available authentication providers.
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
   * Check for existing session on mount.
   *
   * The probe is read-only (HEAD /auth/validate). It used to be a
   * POST /auth/refresh, which since core#3083 consumes a single-use refresh
   * token on every single mount — and which the node rejects outright while
   * the access token is still valid, so it never even worked as a liveness
   * check. mero-js refreshes on its own when a real request comes back 401
   * `token_expired`, and now persists the rotated bundle.
   */
  useEffect(() => {
    const checkSession = async () => {
      if (await hasLiveSession()) {
        setHasAdminToken(true);
        onReady?.();
        setLoading(false);
        return;
      }

      // No live session — drop whatever is left (a revoked family included)
      // and authenticate again. Only show the provider list if it actually
      // loaded; otherwise fall through to the ErrorView, which offers a retry.
      clearTokens();

      const loaded = await loadProviders();
      setShowProviders(loaded);
      setLoading(false);
    };

    checkSession();
  }, [loadProviders, onReady]);

  /**
   * Handle provider selection
   */
  const handleProviderSelect = async (provider: Provider) => {
    if (provider.name === 'user_password') {
      setShowProviders(false);
      setShowUsernamePasswordForm(true);
      return;
    }

    // Nothing else is supported: the wallet path needed GET /auth/challenge,
    // which core#3229 removes.
    setError(`Provider ${provider.name} is not supported`);
  };

  /**
   * Handle username/password authentication
   */
  const handleUsernamePasswordAuth = async (username: string, password: string) => {
    setUsernamePasswordLoading(true);
    setError(null);
    
    try {
      const mero = getMero();
      const tokenPayload = {
        auth_method: 'user_password' as const,
        public_key: username,
        client_name: window.location.href,
        timestamp: Date.now(),
        permissions: [] as string[],
        provider_data: {
          username,
          password
        }
      };

      const response = await mero.auth.generateTokens(tokenPayload) as any;

      if ((response as any).data.access_token && (response as any).data.refresh_token) {
        // MeroJs takes ownership of the bundle and persists it — and every
        // rotation it performs later — through the token store.
        setTokens({
          access_token: (response as any).data.access_token,
          refresh_token: (response as any).data.refresh_token,
        });
        setHasAdminToken(true);
        setShowUsernamePasswordForm(false);
        onReady?.();
      } else {
        throw new Error('Failed to get access token');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      if (isAuthRevoked(err)) {
        // The family is dead; a retry with these tokens can only fail again.
        clearTokens();
        setShowUsernamePasswordForm(false);
        setShowProviders(await loadProviders());
      }
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setUsernamePasswordLoading(false);
    }
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    setShowUsernamePasswordForm(false);
    setShowProviders(true);
    setError(null);
  };

  // Render states
  if (loading) {
    return <Loader />;
  }

  if (error && !showProviders && !showUsernamePasswordForm) {
    return (
      <ErrorView
        message={error}
        onRetry={async () => {
          setError(null);
          setLoading(true);
          const loaded = await loadProviders();
          setShowProviders(loaded);
          setLoading(false);
        }}
      />
    );
  }

  if (showProviders) {
    return (
      <ProviderSelector
        providers={providers}
        onProviderSelect={handleProviderSelect}
        loading={loading}
        error={error}
        onRetry={async () => {
          setError(null);
          setLoading(true);
          const loaded = await loadProviders();
          setShowProviders(loaded);
          setLoading(false);
        }}
      />
    );
  }

  if (showUsernamePasswordForm) {
    return (
      <UsernamePasswordForm
        onSubmit={handleUsernamePasswordAuth}
        onBack={handleBack}
        loading={usernamePasswordLoading}
        error={error}
      />
    );
  }

  // Admin token is secured, render children (flow components)
  if (hasAdminToken) {
    return <>{children}</>;
  }

  return null;
};




