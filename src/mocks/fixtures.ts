/**
 * Test data fixtures for all possible authentication flow scenarios
 */

export const fixtures = {
  providers: {
    all: [
      { 
        name: 'near_wallet', 
        type: 'oauth', 
        description: 'NEAR Wallet', 
        configured: true 
      },
      { 
        name: 'user_password', 
        type: 'credentials', 
        description: 'Username/Password', 
        configured: true 
      },
    ],
    onlyNear: [
      { 
        name: 'near_wallet', 
        type: 'oauth', 
        description: 'NEAR Wallet', 
        configured: true 
      },
    ],
  },
  
  tokens: {
    admin: {
      access_token: 'admin_access_token_mock_12345',
      refresh_token: 'admin_refresh_token_mock_12345',
    },
    user: {
      access_token: 'user_access_token_mock_67890',
      refresh_token: 'user_refresh_token_mock_67890',
    },
  },
  
  applications: {
    meropass: {
      application_id: 'app_meropass_abc123',
      package: 'network.calimero.meropass',
      version: '0.1.1',
      installed: true,
      artifact_uri: 'ipfs://QmMeroPassArtifact',
      metadata: {
        name: 'MeroPass',
        description: 'Password vault application',
      },
    },
    newApp: {
      application_id: 'app_newapp_def456',
      package: 'network.calimero.newapp',
      version: '1.0.0',
      installed: false,
      artifact_uri: 'ipfs://QmNewAppArtifact',
      metadata: {
        name: 'New App',
        description: 'A new application',
      },
    },
    legacyApp: {
      application_id: 'legacy_app_789',
      installed: false,
      artifact_uri: 'http://example.com/app.wasm',
    },
  },
  
  contexts: {
    meropassContexts: [
      {
        id: 'context_personal_vault',
        applicationId: 'app_meropass_abc123',
        name: 'Personal Vault',
        protocol: 'near',
        member_public_key: 'ed25519:PersonalVault123',
      },
      {
        id: 'context_work_vault',
        applicationId: 'app_meropass_abc123',
        name: 'Work Vault',
        protocol: 'near',
        member_public_key: 'ed25519:WorkVault456',
      },
      {
        id: 'context_family_vault',
        applicationId: 'app_meropass_abc123',
        name: 'Family Vault',
        protocol: 'icp',
        member_public_key: 'ed25519:FamilyVault789',
      },
    ],
    emptyContexts: [],
  },
  
  identities: {
    context_personal_vault: [
      { 
        publicKey: 'ed25519:Identity_ABC123', 
        contextId: 'context_personal_vault',
        name: 'john.near',
      },
      { 
        publicKey: 'ed25519:Identity_DEF456', 
        contextId: 'context_personal_vault',
        name: 'john2.near',
      },
    ],
    context_work_vault: [
      { 
        publicKey: 'ed25519:Identity_GHI789', 
        contextId: 'context_work_vault',
        name: 'work.near',
      },
    ],
    context_family_vault: [
      { 
        publicKey: 'ed25519:Identity_JKL012', 
        contextId: 'context_family_vault',
        name: 'family.near',
      },
    ],
  },
  
  manifests: {
    meropass: {
      manifest_version: 1.0,
      id: 'network.calimero.meropass',
      name: 'MeroPass - Password Vault',
      version: '0.1.1',
      artifact: {
        uri: 'ipfs://QmMeroPassArtifact',
        size: 1024000,
        hash: 'sha256:abc123...',
      },
      chains: ['near', 'icp'],
      description: 'Secure password vault on Calimero',
      author: 'Calimero Network',
    },
    newapp: {
      manifest_version: 1.0,
      id: 'network.calimero.newapp',
      name: 'New Application',
      version: '1.0.0',
      artifact: {
        uri: 'ipfs://QmNewAppArtifact',
        size: 512000,
        hash: 'sha256:def456...',
      },
      chains: ['near'],
      description: 'A new test application',
      author: 'Test Author',
    },
  },
  
  challenges: {
    near: {
      challenge: 'mock_challenge_string_for_near_auth',
      nonce: Buffer.from('mock_nonce_value').toString('base64'),
    },
  },
};

export type Fixtures = typeof fixtures;

