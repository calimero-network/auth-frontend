/**
 * Type definitions for auth flow wizard
 */

export type AppMode = 'admin' | 'single-context' | 'multi-context';

export type FlowSource = 'admin' | 'package' | 'application-id';

export interface FlowDetectionResult {
  source: FlowSource;
  mode: AppMode;
}

export interface UrlParams {
  callbackUrl: string;
  appUrl: string;
  permissions: string[];
  
  // Package-based params
  packageName?: string;
  packageVersion?: string;
  registryUrl?: string;
  
  // Legacy params
  applicationId?: string;
  applicationPath?: string;
  
  // Optional
  mode?: AppMode;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface GenerateTokenParams {
  permissions: string[];
  contextId?: string;
  contextIdentity?: string;
  applicationId?: string;
}

