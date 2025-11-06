# Mock Server (MSW) for Auth-Frontend Testing

This directory contains MSW (Mock Service Worker) setup for testing all 5 authentication flow combinations without a real backend.

## 📁 Files

- **`fixtures.ts`** - Test data for all scenarios (providers, tokens, apps, contexts)
- **`scenarios.ts`** - Pre-configured test scenarios for each flow combination
- **`handlers.ts`** - MSW request handlers that intercept API calls
- **`browser.ts`** - MSW setup for browser/dev mode

## 🎯 Scenarios

### 5 Flow Combinations:

1. **Admin Flow** - `admin-flow`
   - No app, admin permissions only
   - Screens: Provider → Permissions → Complete

2. **Application Flow + Package (New)** - `app-multi-package-new`
   - Multi-context mode, package-based, new app
   - Screens: Provider → Manifest → Summary → Permissions → Complete

3. **Application Flow + Package (Existing)** - `app-multi-package-existing`
   - Multi-context mode, package-based, app already installed
   - Shows existing contexts in summary

4. **Context Flow + Package (New)** - `context-single-package-new`
   - Single-context mode, package-based, new app
   - Screens: Provider → Manifest → Summary → Permissions → Context Selection → Complete

5. **Context Flow + Package (Existing)** - `context-single-package-existing`
   - Single-context mode, package-based, app with existing contexts
   - User selects from existing contexts or creates new one

Plus legacy (application-id) variants and error scenarios.

## 🧪 Usage in Tests

```typescript
import { updateScenario } from '../mocks/handlers';
import { scenarios } from '../mocks/scenarios';

// Update mock behavior
updateScenario({
  applicationInstalled: true,
  contextsExist: true,
  networkDelay: 500,
  forceErrors: ['package-not-found'],
});

// Use pre-configured scenario
const scenario = scenarios['app-multi-package-existing'];
renderApp(scenario.urlParams);
```

## 🎨 Usage in Development

Enable MSW in dev mode to test flows without a backend:

```bash
# Enable MSW
VITE_ENABLE_MSW=true pnpm dev

# Then visit with scenario URL params:
http://localhost:5173/auth/login?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create&callback-url=http://localhost:5173/
```

## 🔧 Updating Scenarios

To add a new scenario:

1. Add fixture data in `fixtures.ts`
2. Define scenario config in `scenarios.ts`
3. Update handlers in `handlers.ts` if needed
4. Add integration test in `src/__tests__/flows.integration.test.tsx`

## 📝 Mock Credentials

- Username: `admin`
- Password: `admin`
- Any NEAR wallet auth will succeed automatically

