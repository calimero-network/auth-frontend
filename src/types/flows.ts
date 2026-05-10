/**
 * Type definitions for auth flow wizard.
 *
 * **Auth-frontend no longer drives context/namespace/group selection.**
 * After login + (optional) install + permission approval the auth
 * callback returns only `access_token`, `refresh_token`, `application_id`,
 * and `node_url`. The consuming app picks/creates contexts itself.
 * This matches the `@deprecated since 2.1.0` note on `mero-react`'s
 * `AppMode.SingleContext`.
 */

/**
 * App authorization mode.
 *
 * - `admin` — full administrative access; no app install needed.
 * - `single-context` — **@deprecated**. Kept for URL back-compat with
 *   old client SDKs that still set `mode=single-context`. Treated
 *   identically to `multi-context` here: install if needed →
 *   permissions → token. No context selection step. Will be removed
 *   in a future major when no consumer sends it any more.
 * - `multi-context` — current default; the consuming app manages
 *   context selection.
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

/**
 * @deprecated `contextId` / `contextIdentity` are no longer set by the
 * auth-frontend. Consumers reading the auth callback should expect the
 * fields to be absent and select / create contexts in their own UI.
 * Kept on the type for back-compat with code paths that still echo old
 * URL params; values from auth-frontend are always empty.
 */
export interface GenerateTokenParams {
  permissions: string[];
  /** @deprecated — auth-frontend always sends `''`. */
  contextId?: string;
  /** @deprecated — auth-frontend always sends `''`. */
  contextIdentity?: string;
  applicationId?: string;
}





