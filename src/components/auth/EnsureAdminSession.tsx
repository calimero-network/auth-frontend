import React, { useState, useCallback, useEffect } from 'react';
import { 
  getMero, 
  getAccessToken, 
  getRefreshToken, 
  setAccessToken, 
  setRefreshToken,
  clearAccessToken,
  clearRefreshToken 
} from '../../lib/mero';
import type { AuthProvider as Provider } from '@calimero-network/mero-js/api/auth';
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
   * Load available authentication providers
   */
  const loadProviders = useCallback(async () => {
    try {
      const mero = getMero();
      const response = await mero.auth.getProviders();
      setProviders(response.providers);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load authentication providers');
    }
  }, []);

  /**
   * Validate or refresh existing admin token
   */
  const validateToken = useCallback(async (accessToken: string, refreshToken: string): Promise<boolean> => {
    try {
      const mero = getMero();
      const response = await mero.auth.refreshToken({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      // Token was refreshed successfully
      if (response.access_token && response.refresh_token) {
        setAccessToken(response.access_token);
        setRefreshToken(response.refresh_token);
        return true;
      }

      return false;
    } catch (err) {
      // Check if error message indicates token is still valid
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('Access token still valid') || errorMessage.includes('token valid')) {
        return true;
      }
      
      console.error('Token validation failed:', err);
      return false;
    }
  }, []);

  /**
   * Check for existing session on mount
   */
  useEffect(() => {
    const checkSession = async () => {
      const existingAccessToken = getAccessToken();
      const existingRefreshToken = getRefreshToken();
      
      if (existingAccessToken && existingRefreshToken) {
        const isValid = await validateToken(existingAccessToken, existingRefreshToken);
        
        if (isValid) {
          setHasAdminToken(true);
          onReady?.();
          setLoading(false);
          return;
        }
        
        // Token invalid, clear and show providers
        clearAccessToken();
        clearRefreshToken();
      }
      
      // No valid token, need to authenticate
      await loadProviders();
      setShowProviders(true);
      setLoading(false);
    };
    
    checkSession();
  }, [validateToken, loadProviders, onReady]);

  /**
   * Handle provider selection
   */
  const handleProviderSelect = async (provider: Provider) => {
    if (provider.name === 'user_password') {
      setShowProviders(false);
      setShowUsernamePasswordForm(true);
    } else if (provider.name === 'near_wallet') {
      setError('NEAR wallet authentication not yet implemented');
    } else {
      setError(`Provider ${provider.name} is not supported`);
    }
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

      const response = await mero.auth.getToken(tokenPayload);

      if (response.access_token && response.refresh_token) {
        setAccessToken(response.access_token);
        setRefreshToken(response.refresh_token);
        setHasAdminToken(true);
        setShowUsernamePasswordForm(false);
        onReady?.();
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
    return <ErrorView message={error} onRetry={() => window.location.reload()} />;
  }

  if (showProviders) {
    return (
      <ProviderSelector
        providers={providers}
        onProviderSelect={handleProviderSelect}
        loading={loading}
        error={error}
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




