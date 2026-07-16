import { clearStoredUrlParams, getStoredUrlParam } from './urlParams';
import { getAppEndpointKey } from '../lib/mero';
import { createRegistryClient, registryClient } from './registryClient';

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
//   * a hosted app may also be trusted DYNAMICALLY: when the login flow names
//     a package (`package-name` param), the app registry's bundle manifest
//     declares that app's frontend URL (`links.frontend`) — the moral
//     equivalent of OAuth's registered redirect URIs. A callback whose origin
//     matches the registry-declared frontend origin is trusted. The manifest
//     is only consulted from a TRUSTED registry (the built-in default, or a
//     `registry-url` whose own origin passes the static policy) — otherwise
//     an attacker could point `registry-url` at a registry that "declares"
//     their exfiltration origin.
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
  const url = parseHttpUrl(raw);
  if (!url) return null;

  if (isLoopbackHost(url.hostname)) return url;

  if (allowedOrigins().has(url.origin)) return url;

  return null;
}

const parseHttpUrl = (raw: string | null | undefined): URL | null => {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url;
};

const DEFAULT_REGISTRY_ORIGIN = new URL(
  (import.meta.env.VITE_REGISTRY_URL as string | undefined) ||
    'https://apps.calimero.network',
).origin;

// One registry verdict per origin per page load: the pre-flight check and the
// token handoff both consult this, and the answer cannot meaningfully change
// between them.
const registryVerdicts = new Map<string, Promise<boolean>>();

/**
 * True when the app registry declares `origin` as the frontend origin of the
 * package this login flow is for. Fails closed on any error (no package in
 * the flow, manifest missing, no frontend link, network failure).
 */
const isRegistryDeclaredFrontend = (origin: string): Promise<boolean> => {
  let verdict = registryVerdicts.get(origin);
  if (!verdict) {
    verdict = (async () => {
      const packageName = getStoredUrlParam('package-name');
      if (!packageName) return false;

      // Only consult a registry we already trust. The raw `registry-url`
      // param is attacker-controllable, so it is honored only when its own
      // origin passes the static policy (loopback / same-origin / env
      // allowlist) or is the built-in default; anything else falls back to
      // the default registry.
      const rawRegistry = getStoredUrlParam('registry-url');
      const registryUrl = parseHttpUrl(rawRegistry);
      const registryTrusted =
        registryUrl !== null &&
        (registryUrl.origin === DEFAULT_REGISTRY_ORIGIN ||
          isLoopbackHost(registryUrl.hostname) ||
          allowedOrigins().has(registryUrl.origin));
      const client =
        registryTrusted && registryUrl
          ? createRegistryClient(registryUrl.origin)
          : registryClient;

      try {
        const manifest = await client.getManifest(packageName);
        const frontend = parseHttpUrl(manifest._bundleLinks?.frontend);
        return frontend !== null && frontend.origin === origin;
      } catch (err) {
        console.warn('Registry lookup for callback trust failed:', err);
        return false;
      }
    })();
    registryVerdicts.set(origin, verdict);
  }
  return verdict;
};

/**
 * Full trust resolution for a `callback-url`: the static policy first
 * (loopback, same-origin, env allowlist), then the registry-declared frontend
 * origin of the flow's package. Same contract as
 * [`resolveSafeCallbackUrl`], asynchronously.
 */
export async function resolveTrustedCallbackUrl(
  raw: string | null | undefined,
): Promise<URL | null> {
  const staticUrl = resolveSafeCallbackUrl(raw);
  if (staticUrl) return staticUrl;

  const url = parseHttpUrl(raw);
  if (!url) return null;

  return (await isRegistryDeclaredFrontend(url.origin)) ? url : null;
}

/**
 * Validate `rawCallback` and, only if it is trusted, hand the minted token pair
 * (plus `extra` fragment params and the issuing `node_url`) to it by navigating
 * the browser to `<callback>#access_token=…&refresh_token=…`.
 *
 * This is the single, shared token-handoff path for every auth flow — it is the
 * security boundary that stops an attacker-supplied `callback-url` from
 * exfiltrating the tokens to an arbitrary origin. Callers must funnel through it
 * rather than building the redirect inline.
 *
 * @returns `'ok'` after redirecting, `'missing'` when no callback was provided,
 *   or `'untrusted'` when the callback failed validation. In the non-`'ok'`
 *   cases the tokens are NOT handed out and no navigation happens; the caller
 *   should surface an error.
 */
export async function redirectTokensToCallback(
  rawCallback: string | null | undefined,
  tokens: { access_token: string; refresh_token: string },
  extra: Record<string, string | null | undefined> = {},
): Promise<'ok' | 'missing' | 'untrusted'> {
  if (!rawCallback) return 'missing';

  const returnUrl = await resolveTrustedCallbackUrl(rawCallback);
  if (!returnUrl) return 'untrusted';

  const fragmentParams = new URLSearchParams();
  fragmentParams.set('access_token', tokens.access_token);
  fragmentParams.set('refresh_token', tokens.refresh_token);
  for (const [key, value] of Object.entries(extra)) {
    if (value) fragmentParams.set(key, value);
  }
  // Callback contract (mero-react binds its client to this): the node that
  // issued the tokens, which is NOT this page's origin when the UI is served
  // separately from the node (app-url param).
  fragmentParams.set('node_url', getAppEndpointKey() || window.location.origin);

  clearStoredUrlParams();
  window.location.href = `${returnUrl.toString()}#${fragmentParams.toString()}`;
  return 'ok';
}
