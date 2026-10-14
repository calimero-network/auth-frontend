import { isLoopbackHost, nodeIsLoopback } from './nodeUrl';
import { clearStoredUrlParams, getStoredUrlParam } from './urlParams';
import { getAccessToken, getAppEndpointKey } from '../lib/mero';
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
//   * loopback hosts are allowed only when the NODE is loopback too (local
//     dev, the desktop app). On a remote node a loopback callback is refused
//     for every flow; a hosted or local app must be the node origin, the env
//     allowlist, or the registry-declared frontend.
//   * the auth frontend's own origin (the node) is always allowed
//   * any additional deployed app origins must be explicitly allowlisted via
//     the `VITE_ALLOWED_CALLBACK_ORIGINS` build/env var (comma-separated), e.g.
//     "https://app.example.com,https://chat.example.com"
//   * the NODE may list more trusted app origins in its own config
//     (`trusted_callback_origins` in the embedded auth config, which the
//     desktop app edits under Settings → Developer). The list is read from
//     `/auth/providers` on THIS page's own origin only — the node serving the
//     login page — never from a URL parameter, so a link cannot add to it.
//     Exact origins only, no wildcards; a failed read trusts nothing extra.
//     This is how Vercel preview deployments, which run on a different origin
//     from the registry-declared frontend, can log in to a developer's node.
//   * a hosted app may also be trusted DYNAMICALLY: when the login flow names
//     a package (`package-name` param), the app registry's bundle manifest
//     declares that app's frontend URL (`links.frontend`) — the moral
//     equivalent of OAuth's registered redirect URIs. A callback whose origin
//     matches the registry-declared frontend origin is trusted, and so is one
//     matching any of the bundle's `frontendAliases` (the other URLs the same
//     frontend is served at: an app that moved domain lists its old one). The manifest
//     is only consulted from a TRUSTED registry (the built-in default, or a
//     `registry-url` whose own origin passes the static policy, loopback
//     included only on a loopback node) — otherwise
//     an attacker could point `registry-url` at a registry that "declares"
//     their exfiltration origin.
//   * the same holds for a bundle of that package INSTALLED on this node: its
//     `links.frontend` is trusted too, read from the node with the signed-in
//     session. The registry knows only the latest frontend, and a node running
//     an older bundle (the desktop opens exactly that one) still opens the app
//     at the frontend that bundle names.
//   * everything else is rejected — the caller must NOT redirect the tokens.

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

  if (isLoopbackHost(url.hostname) && nodeIsLoopback()) {
    return url;
  }

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

/** Parse a list of origins, keeping only well-formed http(s) ones. */
export const parseOriginList = (raw: unknown): Set<string> => {
  const origins = new Set<string>();
  if (!Array.isArray(raw)) return origins;
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const url = parseHttpUrl(entry.trim());
    // An origin, not a URL with a path: "https://a.example/x" is a typo for
    // something, and guessing what would widen the list. No wildcards either:
    // `https://*.vercel.app` parses as a URL, but trusting it would hand tokens
    // to anyone's Vercel project.
    if (!url || url.hostname.includes('*')) continue;
    if (url.origin === entry.trim().replace(/\/$/, '')) origins.add(url.origin);
  }
  return origins;
};

// One read per page load: the list is node config and does not change while
// the login page is open.
let nodeTrustedOrigins: Promise<Set<string>> | null = null;

/** Test seam: forget the node's list so the next check reads it again. */
export const resetNodeTrustedOrigins = (): void => {
  nodeTrustedOrigins = null;
};

/**
 * The extra callback origins the node serving this page trusts, from its own
 * `/auth/providers`. Same origin only, and empty on any failure (an older node
 * without the field, a network error, a hosted auth frontend whose own origin
 * is not a node).
 */
const loadNodeTrustedOrigins = (): Promise<Set<string>> => {
  if (!nodeTrustedOrigins) {
    nodeTrustedOrigins = (async () => {
      try {
        const response = await fetch(new URL('/auth/providers', window.location.origin).toString(), {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return new Set<string>();
        const body = await response.json();
        return parseOriginList((body?.data ?? body)?.trusted_callback_origins);
      } catch {
        return new Set<string>();
      }
    })();
  }
  return nodeTrustedOrigins;
};

/**
 * Whether a bundle that declares `frontend` and `aliases` names `origin`: its
 * `links.frontend`, or any entry of its `frontendAliases` (the other URLs the
 * same frontend is served at, e.g. the domain an app moved away from). Only
 * http(s) entries count, compared by exact origin.
 */
const declaresOrigin = (frontend: unknown, aliases: unknown, origin: string): boolean => {
  const declared = [frontend, ...(Array.isArray(aliases) ? aliases : [])];
  return declared.some(
    (url) => parseHttpUrl(typeof url === 'string' ? url : null)?.origin === origin,
  );
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
 * True when the app registry declares `origin` as the frontend origin (or a
 * `frontendAliases` origin) of the package this login flow is for. Fails
 * closed on any error (no package in the flow, manifest missing, no frontend
 * link, network failure).
 */
const isRegistryDeclaredFrontend = (origin: string): Promise<boolean> => {
  let verdict = registryVerdicts.get(origin);
  if (!verdict) {
    verdict = (async () => {
      const packageName = getStoredUrlParam('package-name');
      if (!packageName) return false;

      // Only consult a registry we already trust. The raw `registry-url`
      // param is attacker-controllable, so it is honored only when its own
      // origin passes the static policy (loopback on a loopback node /
      // same-origin / env allowlist) or is the built-in default; anything else falls back to
      // the default registry.
      const rawRegistry = getStoredUrlParam('registry-url');
      const registryUrl = parseHttpUrl(rawRegistry);
      const registryTrusted =
        registryUrl !== null &&
        (registryUrl.origin === DEFAULT_REGISTRY_ORIGIN ||
          (isLoopbackHost(registryUrl.hostname) && nodeIsLoopback()) ||
          allowedOrigins().has(registryUrl.origin));
      const client =
        registryTrusted && registryUrl
          ? createRegistryClient(registryUrl.origin)
          : registryClient;

      try {
        const manifest = await client.getManifest(packageName);
        return declaresOrigin(manifest._bundleLinks?.frontend, manifest._frontendAliases, origin);
      } catch (err) {
        console.warn('Registry lookup for callback trust failed:', err);
        return false;
      }
    })();
    registryVerdicts.set(origin, verdict);
  }
  return verdict;
};

/** An application row's `metadata`: JSON bytes (an array or base64) or an object. */
type InstalledMetadata = { links?: { frontend?: unknown }; frontendAliases?: unknown };

const decodeMetadata = (metadata: unknown): InstalledMetadata | null => {
  try {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as InstalledMetadata;
    }
    let bytes: Uint8Array;
    if (Array.isArray(metadata)) {
      bytes = new Uint8Array(metadata as number[]);
    } else if (typeof metadata === 'string') {
      bytes = Uint8Array.from(atob(metadata), (c) => c.charCodeAt(0));
    } else {
      return null;
    }
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }
};

/**
 * True when a bundle of the flow's package INSTALLED ON THIS NODE declares
 * `origin` as its frontend or one of its `frontendAliases`. Fails closed on any
 * error (no package in the flow, no session, the node refusing the list, no
 * matching install).
 *
 * The registry only knows the package's LATEST frontend, so when an app moves
 * domain, every node still running an older bundle opens it at the old origin
 * — Calimero Desktop and its per-app launchers load exactly the installed
 * bundle's `links.frontend` — and a login from there was refused. The node's
 * own install is at least as trustworthy as the registry's answer: it is the
 * bundle the node's admin installed, read with the session the user just
 * signed in with. Not memoized: the first check can run before that session
 * exists.
 */
const isInstalledFrontend = async (origin: string): Promise<boolean> => {
  const packageName = getStoredUrlParam('package-name');
  const token = getAccessToken();
  if (!packageName || !token) return false;

  const nodeUrl = (getAppEndpointKey() || window.location.origin).replace(/\/$/, '');
  try {
    const response = await fetch(`${nodeUrl}/admin-api/applications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const json = await response.json();
    const apps: unknown = json?.data?.apps;
    if (!Array.isArray(apps)) return false;
    return apps.some((app) => {
      if (app?.package !== packageName) return false;
      const metadata = decodeMetadata(app.metadata);
      return declaresOrigin(metadata?.links?.frontend, metadata?.frontendAliases, origin);
    });
  } catch (err) {
    console.warn('Installed-app lookup for callback trust failed:', err);
    return false;
  }
};

/**
 * Full trust resolution for a `callback-url`: the static policy first
 * (loopback, same-origin, env allowlist), then the origins the node's own
 * config trusts, then the frontend origins (and `frontendAliases`) declared by
 * the flow's package as installed on this node, then as published in the
 * registry. Same contract as [`resolveSafeCallbackUrl`], asynchronously.
 */
export async function resolveTrustedCallbackUrl(
  raw: string | null | undefined,
): Promise<URL | null> {
  const staticUrl = resolveSafeCallbackUrl(raw);
  if (staticUrl) return staticUrl;

  const url = parseHttpUrl(raw);
  if (!url) return null;

  if ((await loadNodeTrustedOrigins()).has(url.origin)) return url;
  if (await isInstalledFrontend(url.origin)) return url;
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
