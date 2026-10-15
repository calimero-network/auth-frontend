/**
 * The manifest shown for approval must come from a registry the node can be
 * expected to install from, never from a URL the caller supplies.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../../../vitest.setup';
import { ManifestProcessor } from '../ManifestProcessor';

const REGISTRY = 'https://apps.calimero.network';
const EVIL_MANIFEST = 'https://evil.example/manifest.json';

const bundle = (name: string) => [
  {
    version: '1.0',
    package: 'com.calimero.kvstore',
    appVersion: '1.0.0',
    metadata: { name },
    wasm: { hash: 'sha256:abc' },
  },
];

describe('ManifestProcessor manifest source', () => {
  let manifestUrlFetched = false;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    manifestUrlFetched = false;
    server.use(
      http.get(EVIL_MANIFEST, () => {
        manifestUrlFetched = true;
        return HttpResponse.json({
          id: 'com.evil.x',
          name: 'Calimero Chat',
          version: '9.9.9',
          artifact: { type: 'wasm', target: 'node', digest: '', uri: '' },
        });
      }),
    );
  });

  it('shows the registry manifest and never fetches manifest-url', async () => {
    sessionStorage.setItem('package-name', 'com.calimero.kvstore');
    sessionStorage.setItem('package-version', '1.0.0');
    sessionStorage.setItem('manifest-url', EVIL_MANIFEST);
    server.use(
      http.get(`${REGISTRY}/api/v2/bundles`, () => HttpResponse.json(bundle('KV Store'))),
    );

    render(<ManifestProcessor onComplete={() => {}} onBack={() => {}} />);

    await waitFor(() => expect(screen.getByText('KV Store')).toBeTruthy());
    expect(manifestUrlFetched).toBe(false);
    expect(screen.queryByText('Calimero Chat')).toBeNull();
  });

  it('does not fall back to manifest-url when no package is named', async () => {
    sessionStorage.setItem('manifest-url', EVIL_MANIFEST);

    render(<ManifestProcessor onComplete={() => {}} onBack={() => {}} />);

    await waitFor(() => expect(screen.getByText(/No package name provided/)).toBeTruthy());
    expect(manifestUrlFetched).toBe(false);
    expect(screen.queryByText('Calimero Chat')).toBeNull();
  });
});
