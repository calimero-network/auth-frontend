# 🧪 Manual Testing Guide: Auth Flows with MSW Mock Server

## 📋 Quick Start

### Step 1: Start Mock Server

```bash
cd /Users/xilosada/dev/calimero/auth-frontend
VITE_ENABLE_MSW=true pnpm dev
```

**Output:**
```
Port 5173 is in use, trying another one...
VITE v6.3.6  ready in 500 ms

➜  Local:   http://localhost:5176/auth/
```

**Note:** Port may vary (5176, 5177, etc). Use the port shown in your terminal.

### Step 2: Verify MSW is Active

Open browser console (F12) and look for:
```
🎭 MSW enabled - API requests will be mocked
[MSW] Mocking enabled.
```

### Step 3: Navigate to Test URL

Use one of the scenario URLs below.

---

## 🎯 Test Scenarios

### **Combo 1: Admin Flow** ✅ WORKING

**URL:**
```
http://localhost:5176/auth/?permissions=admin&mode=admin&callback-url=http://localhost:5173/
```

**Steps:**
1. See provider selection screen
2. Click "Username/Password"
3. Enter: `admin` / `admin`
4. Click "Sign In"
5. See permissions review with 🛑 **RED WARNING**
6. Click "Approve Permissions"
7. Redirects to callback URL

**Expected Screens:**
- Provider Selection
- Username/Password Form
- Permissions Review (with admin warnings)
- Complete (redirect)

---

### **Combo 2: Application Flow + Package (Existing App)**

**URL:**
```
http://localhost:5176/auth/?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/
```

**Steps:**
1. See manifest processor fetching from registry
2. See "✓ Already Installed" with application ID
3. Click "Continue to App"
4. See permissions review
5. Click "Approve Permissions"
6. Complete (no context selection in multi-context mode)

**Expected Screens:**
- Manifest Processor (fetches from real registry!)
- *(TODO: Application Summary)* ← MISSING
- Permissions Review
- Complete (redirect)

**Notes:**
- Fetches actual manifest from `https://mero-registry.vercel.app/api`
- Mock detects app is already installed via MSW
- Shows application ID: `app_meropass_abc123`

---

### **Combo 3: Application Flow + Package (New App)**

**URL:**
```
http://localhost:5176/auth/?package-name=network.calimero.newapp&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/
```

**Steps:**
1. See manifest processor
2. See "Install & Continue" (app not yet installed)
3. Click "Install & Continue"
4. See installation progress
5. See permissions review
6. Complete

**Notes:**
- Will attempt to install (simulated via MSW)
- Installation takes ~500ms (mocked delay)

---

### **Combo 4: Context Flow + Package (Existing)**

**URL:**
```
http://localhost:5176/auth/?package-name=network.calimero.meropass&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/
```

**Steps:**
1. See manifest processor
2. See "Already Installed"
3. Click "Continue to App"
4. See permissions review
5. Click "Approve Permissions"
6. **See context selection screen** ← Key difference!
7. Choose existing context or create new
8. Select identity
9. Final permissions confirmation
10. Complete

**Expected Additional Screens:**
- Context Selector
- Select Context (list of 3 mock contexts)
- Select Identity
- Final Permissions Review

---

### **Combo 5: Context Flow + Legacy (Application ID)**

**URL:**
```
http://localhost:5176/auth/?application-id=app_meropass_abc123&application-path=ipfs://QmMeroPass&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/
```

**Steps:**
1. See application install check
2. Permissions review
3. Context selection
4. Identity selection
5. Complete

---

## 🔐 Mock Credentials

```
Username: admin
Password: admin
```

Any other credentials will return 401 Unauthorized.

---

## 🎛️ Mock Data Available

### Providers
- `near_wallet` - NEAR Wallet (OAuth)
- `user_password` - Username/Password

### Applications
- **MeroPass** (Existing):
  - ID: `app_meropass_abc123`
  - Package: `network.calimero.meropass`
  - Status: Already installed

- **NewApp** (New):
  - ID: `app_newapp_def456`
  - Package: `network.calimero.newapp`
  - Status: Not installed

- **LegacyApp**:
  - ID: `legacy_app_789`
  - Path: `http://example.com/app.wasm`

### Contexts (for app_meropass_abc123)
1. **Personal Vault** (`context_personal_vault`)
   - Protocol: NEAR
   - Identities: `john.near`, `john2.near`

2. **Work Vault** (`context_work_vault`)
   - Protocol: NEAR
   - Identities: `work.near`

3. **Family Vault** (`context_family_vault`)
   - Protocol: ICP
   - Identities: `family.near`

---

## 🔍 Debugging

### Check MSW Status

**In browser console:**
```javascript
// Check if service worker is registered
navigator.serviceWorker.getRegistration().then(reg => console.log('SW:', reg));

// Check sessionStorage
console.log('Session:', Object.fromEntries(Object.entries(sessionStorage)));

// Check what MSW intercepted
// Look for green "[MSW]" logs
```

### Force Different Scenarios

Edit `src/mocks/handlers.ts` and update:

```typescript
// Make app appear installed
updateScenario({ applicationInstalled: true });

// Make contexts exist
updateScenario({ contextsExist: true });

// Force errors
updateScenario({ forceErrors: ['install', 'package-not-found'] });

// Add network delay (ms)
updateScenario({ networkDelay: 2000 });
```

Then refresh the page.

---

## ⚠️ Known Issues

### 1. Hot Reload Clears Session
When you edit files, Vite's hot reload will clear `sessionStorage`, breaking the flow mid-way.

**Solution:** Hard refresh (Cmd+Shift+R) to restart from beginning.

### 2. Registry Fetches Are Real
The manifest fetching actually calls the real registry (`https://mero-registry.vercel.app/api`), not mocked.

**Why:** This is actually good - tests real network integration.  
**To Mock:** Add registry endpoint handlers if needed for offline testing.

### 3. Redirect Not Showing Tokens
The final redirect to callback URL should include tokens in hash fragment, but they're not appearing.

**TODO:** Debug AdminFlow and PackageFlow redirect logic.

---

## 📊 API Endpoints Being Mocked

### Auth API
- `GET  */auth/providers`
- `POST */auth/refresh`
- `POST */auth/token`
- `GET  */auth/challenge`
- `POST */admin/client-key`

### Admin API
- `GET  */admin-api/packages/:packageId/latest`
- `POST */admin-api/install-application`
- `GET  */admin-api/applications/:appId/contexts`
- `GET  */admin-api/applications/:appId`

### Node API
- `GET  */admin-api/contexts`
- `GET  */admin-api/contexts/:contextId/identities`
- `POST */admin-api/contexts`

---

## 🎨 What You Should See

### Provider Selection
- Clean card-based UI
- 2 providers: NEAR Wallet, Username/Password
- Hover effects on cards

### Login Form
- Username and password inputs
- Back and Sign In buttons
- Orange primary button for Sign In

### Permissions Review (Admin)
- 🔴 **"HIGH RISK"** badge
- 🛑 **Red warning banner**: "ADMIN ACCESS REQUESTED"
- ⚠️ **Yellow security notice**
- Clear approve/deny buttons

### Manifest Processor
- 📦 Package icon
- Application name and version
- Package details card with metadata
- "✓ Already Installed" or "Install & Continue" button

---

## 🚀 Next Steps

After seeing the flows working:

1. **Implement Application Summary** - New screen between manifest and permissions
2. **Migrate to Design System** - Replace custom components with `@calimero-network/mero-ui`
3. **Add Context List View** - For single-context mode
4. **Fix Token Redirect** - Ensure tokens appear in callback hash
5. **Add Registry Mocks** - For offline testing

---

## 📝 Testing Checklist

- [ ] Admin flow completes without errors
- [ ] Package flow fetches manifest from registry
- [ ] Already-installed apps show "Continue to App"
- [ ] New apps show "Install & Continue"
- [ ] Permissions review shows all warnings
- [ ] Multi-context skips context selection
- [ ] Single-context shows context selector
- [ ] Error scenarios display properly
- [ ] Back buttons work at each step
- [ ] Tokens appear in callback URL hash

---

**Last Updated:** 2025-11-06  
**Status:** ✅ Mock Server Working | ⚠️ Some flows need completion  
**Port:** Check terminal output (usually 5176)

