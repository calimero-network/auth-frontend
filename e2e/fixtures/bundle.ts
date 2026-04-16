/** Factory for V2 BundleManifest mock objects (what the registry returns) */
export const mockBundle = (overrides: Record<string, unknown> = {}) => ({
  version: '1.0',
  package: 'com.example.myapp',
  appVersion: '0.2.0',
  metadata: {
    name: 'My App',
    description: 'Test app description',
    author: 'Test Author',
  },
  wasm: {
    path: 'app.wasm',
    hash: 'sha256:abc123',
    size: 1024,
  },
  links: {
    frontend: 'http://app.local',
  },
  ...overrides,
});
