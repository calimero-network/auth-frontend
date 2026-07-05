/**
 * Contract pin: minting a client key degrades gracefully on nodes that
 * predate core 0.11.0-rc.11 (PR calimero-network/core#3201).
 *
 * Apps (via mero-react, PR calimero-network/mero-react#42) request extra
 * grants at login: `namespace`, `group`, `blob`, `context:alias`. Older nodes
 * (rc.10 and earlier) reject the WHOLE mint with a 400 when any requested
 * grant string doesn't parse: `generate_client_key_handler` validates each
 * permission via `root_key.has_permission()`
 * (crates/auth/src/api/handlers/client_keys.rs), and `Key::has_permission`
 * fails on unparseable strings before any admin short-circuit. Without a
 * fallback, a new app on an old node dead-ends at login with
 * "Root key does not have permission: namespace".
 *
 * `mintClientKeyWithGrantFallback` retries the mint without the rejected
 * grant, one grant per round, but NEVER drops the base `context:*` trio —
 * a rejection of those is a genuine permission failure and must surface.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../vitest.setup';
import { mintClientKeyWithGrantFallback } from '../utils/mintClientKey';

const BASE_TRIO = ['context:create', 'context:list', 'context:execute'];
const NEW_GRANTS = ['namespace', 'group', 'blob', 'context:alias'];
const REQUESTED = [...BASE_TRIO, ...NEW_GRANTS];

/**
 * Mock an rc.10-era node: 400 the whole mint whenever the request contains
 * any grant in `unsupported`, naming the first offender the way core's auth
 * service does. Records the permissions of every attempt.
 */
function mockNode(unsupported: string[], attempts: string[][]) {
  server.use(
    http.post('*/admin/client-key', async ({ request }) => {
      const body = (await request.json()) as { permissions: string[] };
      attempts.push(body.permissions);

      const offender = body.permissions.find((p) => unsupported.includes(p));
      if (offender) {
        return HttpResponse.json(
          { error: `Root key does not have permission: ${offender}` },
          { status: 400 },
        );
      }
      return HttpResponse.json({
        data: { access_token: 'access', refresh_token: 'refresh' },
      });
    }),
  );
}

const mint = () =>
  mintClientKeyWithGrantFallback({
    context_id: '',
    context_identity: '',
    permissions: REQUESTED,
  });

describe('client-key grant fallback (pre-rc.11 nodes)', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('passes the new grants through untouched when the node accepts them', async () => {
    const attempts: string[][] = [];
    mockNode([], attempts);

    const response = await mint();

    expect(response.access_token).toBe('access');
    expect(attempts).toHaveLength(1);
    expect([...attempts[0]].sort()).toEqual([...REQUESTED].sort());
    expect(warn).not.toHaveBeenCalled();
  });

  it('retries without `namespace` on a 400 naming it, keeping the rest', async () => {
    const attempts: string[][] = [];
    mockNode(['namespace'], attempts);

    const response = await mint();

    expect(response.access_token).toBe('access');
    expect(attempts).toHaveLength(2);
    expect([...attempts[1]].sort()).toEqual(
      [...BASE_TRIO, 'group', 'blob', 'context:alias'].sort(),
    );
    expect(warn).toHaveBeenCalledWith(
      'node does not support grant namespace — dropping (pre-rc.11 core)',
    );
  });

  it('drops group/blob/context:alias across repeated 400s and succeeds with the base trio', async () => {
    const attempts: string[][] = [];
    mockNode(NEW_GRANTS, attempts);

    const response = await mint();

    expect(response.access_token).toBe('access');
    // One rejection per unsupported grant, then the accepted mint.
    expect(attempts).toHaveLength(NEW_GRANTS.length + 1);
    expect([...attempts.at(-1)!].sort()).toEqual([...BASE_TRIO].sort());
    for (const grant of NEW_GRANTS) {
      expect(warn).toHaveBeenCalledWith(
        `node does not support grant ${grant} — dropping (pre-rc.11 core)`,
      );
    }
  });

  it('does NOT retry when the node rejects a base grant (context:execute) — the error surfaces', async () => {
    const attempts: string[][] = [];
    mockNode(['context:execute'], attempts);

    await expect(mint()).rejects.toThrow(
      'Root key does not have permission: context:execute',
    );
    expect(attempts).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });
});
