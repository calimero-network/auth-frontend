/**
 * Pre-configured test scenarios for all 5 authentication flow combinations
 */

export type TestScenario = 
  | 'admin-flow'
  | 'app-multi-package-new'
  | 'app-multi-package-existing'
  | 'app-multi-legacy-new'
  | 'app-multi-legacy-existing'
  | 'context-single-package-new'
  | 'context-single-package-existing'
  | 'context-single-legacy-new'
  | 'context-single-legacy-existing'
  | 'error-network-failure'
  | 'error-unauthorized'
  | 'error-app-not-found'
  | 'error-install-failed';

export interface ScenarioConfig {
  urlParams: string;
  mocks: {
    providersAvailable: boolean;
    applicationInstalled: boolean;
    contextsExist: boolean;
    networkErrors: string[];
    networkDelay: number;
  };
  expected: {
    flow: 'admin' | 'package' | 'application-id';
    mode: 'admin' | 'single-context' | 'multi-context';
    screens: string[];
  };
}

export const scenarios: Record<TestScenario, ScenarioConfig> = {
  // ========================================
  // Combo 1: Admin Flow (No App)
  // ========================================
  'admin-flow': {
    urlParams: '?permissions=admin&mode=admin&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'admin',
      mode: 'admin',
      screens: ['ProviderSelector', 'PermissionsView', 'Complete'],
    },
  },
  
  // ========================================
  // Combo 2: Application Flow + Package (New App)
  // ========================================
  'app-multi-package-new': {
    urlParams: '?package-name=network.calimero.newapp&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'multi-context',
      screens: ['ProviderSelector', 'ManifestProcessor', 'ApplicationSummary', 'PermissionsView', 'Complete'],
    },
  },
  
  // ========================================
  // Combo 3: Application Flow + Package (Existing App)
  // ========================================
  'app-multi-package-existing': {
    urlParams: '?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: true,
      contextsExist: true,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'multi-context',
      screens: ['ProviderSelector', 'ManifestProcessor', 'ApplicationSummary(with contexts)', 'PermissionsView', 'Complete'],
    },
  },
  
  // ========================================
  // Combo 4: Application Flow + Legacy (New App)
  // ========================================
  'app-multi-legacy-new': {
    urlParams: '?application-id=legacy_app_789&application-path=http://example.com/app.wasm&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'application-id',
      mode: 'multi-context',
      screens: ['ProviderSelector', 'ApplicationInstallCheck', 'ApplicationSummary', 'PermissionsView', 'Complete'],
    },
  },
  
  // ========================================
  // Combo 5: Application Flow + Legacy (Existing App)
  // ========================================
  'app-multi-legacy-existing': {
    urlParams: '?application-id=app_meropass_abc123&application-path=ipfs://QmMeroPassArtifact&mode=multi-context&permissions=context:create&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: true,
      contextsExist: true,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'application-id',
      mode: 'multi-context',
      screens: ['ProviderSelector', 'ApplicationInstallCheck', 'ApplicationSummary(with contexts)', 'PermissionsView', 'Complete'],
    },
  },
  
  // ========================================
  // Context Flow + Package (New App)
  // ========================================
  'context-single-package-new': {
    urlParams: '?package-name=network.calimero.newapp&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'single-context',
      screens: ['ProviderSelector', 'ManifestProcessor', 'ApplicationSummary', 'PermissionsView', 'ContextSelector', 'CreateContext', 'Complete'],
    },
  },
  
  // ========================================
  // Context Flow + Package (Existing App)
  // ========================================
  'context-single-package-existing': {
    urlParams: '?package-name=network.calimero.meropass&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: true,
      contextsExist: true,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'single-context',
      screens: ['ProviderSelector', 'ManifestProcessor', 'ApplicationSummary', 'PermissionsView', 'ContextSelector', 'SelectContext', 'SelectIdentity', 'PermissionsConfirm', 'Complete'],
    },
  },
  
  // ========================================
  // Context Flow + Legacy (New App)
  // ========================================
  'context-single-legacy-new': {
    urlParams: '?application-id=legacy_app_789&application-path=http://example.com/app.wasm&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'application-id',
      mode: 'single-context',
      screens: ['ProviderSelector', 'ApplicationInstallCheck', 'ApplicationSummary', 'PermissionsView', 'ContextSelector', 'CreateContext', 'Complete'],
    },
  },
  
  // ========================================
  // Context Flow + Legacy (Existing App)
  // ========================================
  'context-single-legacy-existing': {
    urlParams: '?application-id=app_meropass_abc123&application-path=ipfs://QmMeroPassArtifact&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: true,
      contextsExist: true,
      networkErrors: [],
      networkDelay: 0,
    },
    expected: {
      flow: 'application-id',
      mode: 'single-context',
      screens: ['ProviderSelector', 'ApplicationInstallCheck', 'ApplicationSummary', 'PermissionsView', 'ContextSelector', 'SelectContext', 'SelectIdentity', 'PermissionsConfirm', 'Complete'],
    },
  },
  
  // ========================================
  // Error Scenarios
  // ========================================
  'error-network-failure': {
    urlParams: '?package-name=network.calimero.meropass&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: false,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: ['providers', 'install'],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'single-context',
      screens: ['ErrorView'],
    },
  },
  
  'error-unauthorized': {
    urlParams: '?permissions=admin&mode=admin&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: ['unauthorized'],
      networkDelay: 0,
    },
    expected: {
      flow: 'admin',
      mode: 'admin',
      screens: ['ProviderSelector', 'ErrorView'],
    },
  },
  
  'error-app-not-found': {
    urlParams: '?package-name=network.calimero.notfound&mode=multi-context&permissions=context:create&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: ['package-not-found'],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'multi-context',
      screens: ['ProviderSelector', 'ManifestProcessor', 'ErrorView'],
    },
  },
  
  'error-install-failed': {
    urlParams: '?package-name=network.calimero.newapp&mode=multi-context&permissions=context:create&callback-url=http://localhost:5173/',
    mocks: {
      providersAvailable: true,
      applicationInstalled: false,
      contextsExist: false,
      networkErrors: ['install'],
      networkDelay: 0,
    },
    expected: {
      flow: 'package',
      mode: 'multi-context',
      screens: ['ProviderSelector', 'ManifestProcessor', 'ErrorView'],
    },
  },
};

