# 🎭 Mock Server Setup Complete!

## ✅ What's Been Implemented

### 1. MSW (Mock Service Worker) Installation
- ✅ `msw@2.12.0` installed
- ✅ `@testing-library/user-event@14.6.1` installed
- ✅ Service worker initialized in `/public` directory

### 2. Mock Infrastructure Created

#### **`src/mocks/fixtures.ts`**
Test data for all scenarios including:
- Authentication providers (NEAR wallet, username/password)
- Admin and user tokens
- Applications (MeroPass, new apps, legacy apps)
- Contexts (3 mock contexts with identities)
- Manifests from registry

#### **`src/mocks/scenarios.ts`**
Pre-configured scenarios for **all 5 flow combinations**:

1. **Admin Flow** - `admin-flow`
2. **App Multi Package New** - `app-multi-package-new`
3. **App Multi Package Existing** - `app-multi-package-existing`
4. **Context Single Package New** - `context-single-package-new`
5. **Context Single Package Existing** - `context-single-package-existing`

Plus legacy variants and error scenarios (13 total scenarios).

#### **`src/mocks/handlers.ts`**
Complete MSW handlers for **ALL** auth-frontend API calls:

**Auth API:**
- `GET /auth/providers`
- `POST /auth/refresh`
- `POST /auth/token`
- `GET /auth/challenge`
- `POST /auth/generate-client-key`

**Admin API:**
- `GET /admin-api/packages/:packageId/latest`
- `POST /admin-api/applications/install`
- `GET /admin-api/applications/:appId/contexts`
- `GET /admin-api/applications/:appId`

**Node API:**
- `GET /admin-api/contexts`
- `GET /admin-api/contexts/:contextId/identities`
- `POST /admin-api/contexts`

#### **`src/mocks/browser.ts`**
Browser setup for development mode testing.

### 3. Testing Infrastructure

#### **`vitest.setup.ts`**
- Initializes MSW server before all tests
- Resets scenario after each test
- Mocks window.location for URL testing
- Suppresses noisy console logs

#### **`vitest.config.ts`** (Updated)
- Added MSW setup file
- Configured inline dependencies for ESM compatibility
- Added path aliases

#### **`src/main.tsx`** (Updated)
- Added MSW initialization for dev mode
- Controlled via `VITE_ENABLE_MSW=true` env var

### 4. Tests Created

#### **`src/__tests__/mocks.test.ts`** ✅ PASSING
Comprehensive tests for all mock handlers:
- ✅ Auth API mocking (19 tests)
- ✅ Admin API mocking
- ✅ Node API mocking
- ✅ Scenario management
- ✅ Error scenarios

**Result: 19/19 tests passing! 🎉**

#### **`src/__tests__/flows.integration.test.tsx`** ⚠️ PENDING
Full integration tests for all 5 flow combinations.
*Note: Requires resolving styled-components ESM issues in test environment.*

## 📊 Test Coverage

### Working Tests
- ✅ `src/utils/__tests__/urlParams.test.ts` (17 tests)
- ✅ `src/hooks/__tests__/useFlowDetection.test.ts` (21 tests)
- ✅ `src/__tests__/mocks.test.ts` (19 tests)

**Total: 57 tests passing**

## 🚀 Usage

### Running Tests

```bash
# Run all tests
pnpm test

# Run only mock handler tests
pnpm test src/__tests__/mocks.test.ts

# Watch mode
pnpm test:watch
```

### Development with Mocks

Enable MSW in development to test without backend:

```bash
# Start dev server with mocks enabled
VITE_ENABLE_MSW=true pnpm dev
```

Then navigate with test URL params:

```
http://localhost:5173/auth/login?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create&callback-url=http://localhost:5173/
```

### Test Credentials

```typescript
// Username/Password Auth
username: 'admin'
password: 'admin'

// NEAR wallet - any signature succeeds
```

### Updating Mock Behavior

```typescript
import { updateScenario } from './mocks/handlers';

// Make application appear installed
updateScenario({ applicationInstalled: true });

// Make contexts exist
updateScenario({ contextsExist: true });

// Force errors
updateScenario({ forceErrors: ['install', 'package-not-found'] });

// Add network delay
updateScenario({ networkDelay: 1000 });
```

## 📋 Scenario URLs

All scenarios have pre-configured URL parameters in `src/mocks/scenarios.ts`:

```typescript
// Example: Admin Flow
const scenario = scenarios['admin-flow'];
// URL: ?permissions=admin&mode=admin&callback-url=...

// Example: Application Flow + Package (Existing)
const scenario = scenarios['app-multi-package-existing'];
// URL: ?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create&callback-url=...
```

## 🐛 Known Issues

### Styled-Components in Integration Tests
The full integration tests (`flows.integration.test.tsx`) currently fail due to styled-components ESM/CJS compatibility in the test environment. The mock handlers themselves work perfectly (verified by `mocks.test.ts`).

**Workaround Options:**
1. Use `mocks.test.ts` style tests (direct API testing)
2. Mock styled-components in test setup
3. Use Playwright E2E tests for full UI flow testing

## 🎯 Next Steps

1. **Add Application Summary Component** (from design system discussion)
   - Show app installation status
   - Display existing contexts for multi-context mode
   - Prominent warnings for admin permissions

2. **Design System Migration**
   - Replace custom Button with `@calimero-network/mero-ui Button`
   - Use Card, Alert, Banner from design system
   - Use Stack, Flex, Grid for layouts

3. **Resolve Styled-Components Test Issues**
   - Configure proper ESM handling for styled-components
   - Or shift to Playwright for full integration tests

4. **Multi-Context Flow Optimization**
   - Check if app is installed before showing installation flow
   - Show existing contexts in summary for already-installed apps

## 📚 Documentation

- **Mock Setup**: `src/mocks/README.md`
- **Scenarios**: See `src/mocks/scenarios.ts` for all available scenarios
- **Test Examples**: See `src/__tests__/mocks.test.ts` for usage examples

---

**Created:** 2025-11-06  
**Status:** ✅ Mock Server Working | ⚠️ Integration Tests Pending  
**Tests Passing:** 57/57 (excluding styled-components integration tests)

