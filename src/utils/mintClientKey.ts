import {
  generateClientKeyDirect,
  GenerateClientKeyRequest,
  GenerateClientKeyResponse,
} from '../lib/mero';

/**
 * Mint a client key, degrading gracefully on nodes that predate core
 * 0.11.0-rc.11 (PR calimero-network/core#3201).
 *
 * Apps (via mero-react, PR calimero-network/mero-react#42) now request extra
 * grants at login: `namespace`, `group`, `blob`, `context:alias`. Newer nodes
 * accept them, but older nodes reject the ENTIRE mint with a 400 when any
 * requested grant string doesn't parse: `generate_client_key_handler`
 * validates each permission via `root_key.has_permission()`, and
 * `Key::has_permission` fails on unparseable strings before any admin
 * short-circuit. Without a fallback, a new app on an old node dead-ends at
 * login with "Root key does not have permission: namespace".
 *
 * Strategy: when the mint fails and the error message names a specific
 * permission (`... does not have permission: <grant>`), drop that grant from
 * the request and retry, until the mint succeeds or nothing droppable is
 * left. The base `context:*` trio is never dropped — if the node rejects one
 * of THOSE, that's a genuine permission failure and it surfaces as before.
 * Iterations are capped at the number of originally requested grants.
 */

/** Grants that must never be silently dropped — the app can't run without them. */
const BASE_GRANTS = new Set(['context:create', 'context:list', 'context:execute']);

/**
 * How the node's rejection surfaces here: `generateClientKeyDirect` throws a
 * plain `Error` whose message is the node's `error.message` (e.g.
 * "Root key does not have permission: namespace").
 */
const MISSING_GRANT_RE = /does not have permission:\s*(\S+)/;

export async function mintClientKeyWithGrantFallback(
  request: GenerateClientKeyRequest,
): Promise<GenerateClientKeyResponse> {
  let permissions = [...request.permissions];
  // One retry per originally requested grant, at most.
  const maxRetries = permissions.length;

  for (let attempt = 0; ; attempt++) {
    try {
      return await generateClientKeyDirect({ ...request, permissions });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const grant = MISSING_GRANT_RE.exec(message)?.[1];

      if (
        attempt >= maxRetries || // iteration cap
        !grant || // not a per-grant rejection — some other failure
        BASE_GRANTS.has(grant) || // base trio: never dropped, fail as today
        !permissions.includes(grant) // node named something we didn't request
      ) {
        throw err;
      }

      console.warn(`node does not support grant ${grant} — dropping (pre-rc.11 core)`);
      permissions = permissions.filter((p) => p !== grant);
    }
  }
}
