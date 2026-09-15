/**
 * The node endpoint must survive this screen.
 *
 * ⚠️ WHY THIS EXISTS. ManifestProcessor used to run, unconditionally on mount:
 *
 *     useEffect(() => { setAppEndpointKey(window.location.origin); }, []);
 *
 * which threw away the `app-url` the caller passed and repointed every later
 * admin call at whatever host happened to be serving the auth UI. The install
 * then answered 404 from a static file server and the flow reported "check
 * that your node is running and reachable" — while the node was running and
 * reachable.
 *
 * It is a no-op in the deployment it was written for, because merod serves
 * this UI itself and origin === node. That is exactly why it survived: the one
 * environment it is correct in is the one everybody tested.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

import { ManifestProcessor } from '../ManifestProcessor';
import { getAppEndpointKey } from '../../../lib/mero';

const NODE = 'http://node.test';

describe('ManifestProcessor', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // What `handleUrlParams()` stores when the caller passes ?app-url=.
    localStorage.setItem('calimero_app_endpoint', NODE);
    sessionStorage.setItem('package-name', 'com.calimero.mero-blocks');
    sessionStorage.setItem('package-version', '0.0.3');
  });

  it('leaves the configured node endpoint alone on mount', () => {
    // window.location.origin is http://localhost:5173 in this environment
    // (vitest.setup.ts), so a regression would overwrite NODE with that.
    expect(window.location.origin).not.toBe(NODE);

    render(<ManifestProcessor onComplete={() => {}} onBack={() => {}} />);

    expect(getAppEndpointKey()).toBe(NODE);
  });
});
