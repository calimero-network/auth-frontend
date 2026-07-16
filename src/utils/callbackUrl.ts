// Allowlist validation for the SSO `callback-url`.
//
// After a successful login the auth frontend redirects the freshly-minted
// access + refresh token pair into `callback-url`'s fragment. If that URL is
// taken from the request unvalidated, an attacker who lures a logged-in user to
//   http://<node>/auth/...?callback-url=https://evil.example&permissions=admin
// and gets them to approve the consent screen exfiltrates a working token pair
// to an arbitrary origin (the classic OAuth open-redirect token-leak). This
// module gates the redirect so tokens can only ever be handed to a trusted
// origin.
//
// Trust policy (least surprise, non-breaking for local/desktop):
//   * scheme must be http/https — blocks `javascript:`, `data:`, `file:` …
//   * loopback hosts are always allowed (local dev, the node itself, and
//     desktop app windows served from localhost)
//   * the auth frontend's own origin (the node) is always allowed
//   * any additional deployed app origins must be explicitly allowlisted via
//     the `VITE_ALLOWED_CALLBACK_ORIGINS` build/env var (comma-separated), e.g.
//     "https://app.example.com,https://chat.example.com"
//   * everything else is rejected — the caller must NOT redirect the tokens.

const isLoopbackHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.localhost')
  );
};

const allowedOrigins = (): Set<string> => {
  const origins = new Set<string>();

  // Same-origin as the auth frontend (the node) is always trusted.
  try {
    origins.add(window.location.origin);
  } catch {
    /* no window origin (non-browser) — nothing to add */
  }

  // Operator-configured trusted app origins for apps served from a different
  // origin than the node (e.g. a hosted frontend). Malformed entries are ignored.
  const configured = import.meta.env.VITE_ALLOWED_CALLBACK_ORIGINS as
    | string
    | undefined;
  if (configured) {
    for (const raw of configured.split(',')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        /* ignore a malformed allowlist entry rather than failing closed on all */
      }
    }
  }

  return origins;
};

/**
 * Parse and validate a `callback-url` against the trust policy above.
 *
 * @returns the parsed `URL` when the callback is trusted, or `null` when it is
 *   missing, malformed, uses a non-http(s) scheme, or points at an untrusted
 *   origin. On `null`, the caller MUST NOT redirect the token pair.
 */
export function resolveSafeCallbackUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (isLoopbackHost(url.hostname)) return url;

  if (allowedOrigins().has(url.origin)) return url;

  return null;
}
