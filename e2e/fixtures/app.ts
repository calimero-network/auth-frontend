export const mockApp = (overrides: Record<string, unknown> = {}) => ({
  id: 'wasm-uuid-001',
  package: null,
  version: '0.1.0',
  signer_id: 'did:key:z6Mk...',
  ...overrides,
});

export const mockContext = (overrides: Record<string, unknown> = {}) => ({
  id: 'ctx-001',
  applicationId: 'wasm-uuid-001',
  name: 'Test Context',
  protocol: 'near',
  ...overrides,
});

export const DEV_SIGNER_ID = 'did:key:z6MknF3p5L5FDHJQ7FREUapuX4Wmp4MtF6WrHYaXS2B3eZQd';
