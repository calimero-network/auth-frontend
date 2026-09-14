/**
 * The install call's WIRE SHAPE, asserted against the node's real strictness.
 *
 * ⚠️ WHY THIS EXISTS. Every install through the auth screen answered with
 *
 *     unknown field `url`, expected `package` or `version`
 *
 * and the whole suite stayed green, because the shared handler accepted any
 * body and both call sites cast their argument to `any`. A type is not a
 * contract check once it has been cast away, so this drives the hook and
 * asserts what actually left the browser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../../vitest.setup';
import { useContextCreation } from '../useContextCreation';

const NODE = 'http://node.test';

describe('checkAndInstallApplication', () => {
  let bodies: Record<string, unknown>[];

  beforeEach(() => {
    bodies = [];
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('calimero_app_endpoint', NODE);
    localStorage.setItem('calimero_access_token', 'a');
    localStorage.setItem('calimero_refresh_token', 'r');

    server.use(
      // Not installed yet, so the hook takes its install branch.
      http.get(`${NODE}/admin-api/applications/:id`, () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
      http.post(`${NODE}/admin-api/install-application`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const unknown = Object.keys(body).find((k) => k !== 'package' && k !== 'version');
        if (unknown) {
          return HttpResponse.json(
            { error: `unknown field \`${unknown}\`, expected \`package\` or \`version\`` },
            { status: 400 },
          );
        }
        return HttpResponse.json({ data: { applicationId: 'app-installed' } });
      }),
    );
  });

  it('installs by package coordinates, never by url', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.mero-blocks');
    sessionStorage.setItem('package-version', '0.0.3');

    const { result } = renderHook(() => useContextCreation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.checkAndInstallApplication('some-app-id');
    });

    expect(ok).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({
      package: 'com.calimero.mero-blocks',
      version: '0.0.3',
    });
    // The two fields that made every install fail.
    expect(bodies[0]).not.toHaveProperty('url');
    expect(bodies[0]).not.toHaveProperty('metadata');
  });

  it('does not attempt an install when no coordinates are known', async () => {
    const { result } = renderHook(() => useContextCreation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.checkAndInstallApplication('some-app-id');
    });

    // Treated as already installed, exactly as the path-less branch used to be.
    expect(ok).toBe(true);
    expect(bodies).toHaveLength(0);
  });
});
