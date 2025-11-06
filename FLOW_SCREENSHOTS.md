# 📸 Auth Flow Visualizations (MSW Mock Server)

**Date:** 2025-11-06  
**Status:** ✅ Working with Mock Server  
**Server:** http://localhost:5176/auth/  
**MSW:** Enabled (`VITE_ENABLE_MSW=true`)

---

## 🎭 Mock Server Setup

The auth-frontend is running with MSW (Mock Service Worker) enabled, which intercepts all API calls and returns mock data. This allows testing all 5 authentication flow combinations without a real backend.

### Mock Configuration:
- **Providers:** NEAR Wallet, Username/Password
- **Mock Credentials:** `admin` / `admin`
- **Applications:** MeroPass (existing), NewApp (new), LegacyApp
- **Contexts:** 3 contexts (Personal Vault, Work Vault, Family Vault)
- **Registry:** Fetching from real local registry (localhost:8082)

---

## 🔴 **Combo 1: Admin Flow** (Completed)

**URL:**
```
http://localhost:5176/auth/?permissions=admin&mode=admin&callback-url=http://localhost:5173/
```

### Flow Steps:

#### **Step 1: Provider Selection**
- Shows 2 providers: NEAR Wallet, Username/Password
- Clean UI with provider cards
- Click on Username/Password →

#### **Step 2: Username/Password Form**
- Username input
- Password input  
- Back and Sign In buttons
- Enter: `admin` / `admin` →

#### **Step 3: Permissions Review** ✨
- **"Review Permissions"** heading
- Permission card with:
  - 🔴 **"HIGH RISK"** badge
  - 🔐 **"Full Node Administration"**
  - Description: "Complete control over node configuration and all data"
- 🛑 **Red Warning Banner**:
  - "ADMIN ACCESS REQUESTED"
  - "Granting **admin** permission gives this application unrestricted control..."
- ⚠️ **Yellow Security Notice**
- **Deny** and **Approve Permissions** buttons →

#### **Step 4: Complete**
- Redirects to callback URL: `http://localhost:5173/`
- *Note: Token hash needs fixing in mock*

**Screenshots:**
1. `01-admin-providers-working.png` - Provider selection
2. `02-admin-username-password-form.png` - Login form
3. `03-admin-permissions-review.png` - Permissions with warnings

---

## 📦 **Combo 2/3: Package Flow - Multi-Context Mode**

**URL (Existing App):**
```
http://localhost:5176/auth/?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/
```

### Flow Steps:

#### **Step 1: Provider Selection**
- (Skipped if already authenticated with admin token)

#### **Step 2: Manifest Processing** ✨
Beautiful card showing package details:
- 📦 Icon
- **"MeroPass - Password Vault"** v0.1.1
- **Package Details** card:
  - Package ID: `network.calimero.meropass`
  - Type: `wasm`
  - Target: `node`
  - Chains: `near:testnet, near:mainnet`
  - Provides: `password.vault@1, secret.manager@1`
- **Back** and **Install & Continue** buttons →

#### **Step 3: Application Summary** (MISSING - TODO)
Should show:
- Application installation status (new vs existing)
- Existing contexts that will get access
- Permissions preview

#### **Step 4: Permissions Review**
Similar to admin flow but context-scoped

#### **Step 5: Complete**
- Multi-context mode skips context selection
- Redirects with tokens + application_id

**Screenshots:**
4. `04-package-flow-manifest.png` - Manifest processor

---

## 🎯 **Observations & Next Steps**

### ✅ What's Working:
1. **MSW Setup** - All auth API calls intercepted correctly
2. **Flow Detection** - Correctly identifies admin vs package flows
3. **Provider Selection** - Clean UI, clickable cards
4. **Login Form** - Username/password working
5. **Permissions View** - Beautiful warnings and risk indicators
6. **Manifest Fetching** - Fetching from real local registry!

### ⚠️ What Needs Work:
1. **Token Redirect** - Hash fragment not appearing in callback URL
2. **Application Summary** - New screen missing (should show between manifest and permissions)
3. **Registry Mocking** - Add registry endpoint mocks for offline testing
4. **Admin API Mocks** - Need to wrap responses in `{data: ...}` format
5. **Design System Migration** - Replace custom Button/Card with `@calimero-network/mero-ui`

### 📋 Missing Screens to Implement:

#### **Application Summary Component** (High Priority)
After authentication and before permissions, show:

```
┌───────────────────────────────────────────────────┐
│  🔐 Authorization Request                         │
│                                                   │
│  📦 MeroPass - Password Vault                     │
│     from: http://localhost:5173                   │
│                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                   │
│  📦 Application Status:                           │
│     ✅ Already Installed  (or 🆕 Will install)    │
│                                                   │
│  🔑 Contexts with Access (if multi-context):      │
│     • Personal Vault (john.near)                  │
│     • Work Vault (work.near)                      │
│     • Family Vault (family.icp)                   │
│                                                   │
│  ⚠️  Requested Permissions:                       │
│     • context:create                              │
│     • context:list                                │
│                                                   │
│  [Cancel] [Continue]                              │
└───────────────────────────────────────────────────┘
```

This should use design system components:
- `<Card>` from `@calimero-network/mero-ui`
- `<Banner variant="info">` for status
- `<Badge>` for permission labels
- `<Stack>` for layout

---

## 🧪 Test URLs for All Scenarios

### Admin Flow
```bash
http://localhost:5176/auth/?permissions=admin&mode=admin&callback-url=http://localhost:5173/
```

### App Multi + Package (New)
```bash
http://localhost:5176/auth/?package-name=network.calimero.newapp&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/
```

### App Multi + Package (Existing)
```bash
http://localhost:5176/auth/?package-name=network.calimero.meropass&mode=multi-context&permissions=context:create,context:list&callback-url=http://localhost:5173/
```

### Context Single + Package (Existing)
```bash
http://localhost:5176/auth/?package-name=network.calimero.meropass&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/
```

### Context Single + Legacy
```bash
http://localhost:5176/auth/?application-id=app_meropass_abc123&application-path=ipfs://QmMeroPass&mode=single-context&permissions=context:execute&callback-url=http://localhost:5173/
```

---

## 🎨 Design System Components Available

From `@calimero-network/mero-ui`:

### Layout
- `<Stack>` - Vertical/horizontal stacking with spacing
- `<Flex>` - Flexbox layout  
- `<Grid>` - Grid layout
- `<Box>` - Generic container

### Components
- `<Card>` - Flexible card with header, content, actions
- `<Button>` - Buttons with variants (primary, secondary, etc.)
- `<Banner>` - Alert/warning banners (info, success, warning, error)
- `<Alert>` - Inline alerts
- `<Badge>` - Small status indicators
- `<Input>` - Text inputs
- `<Form>` - Form wrapper

### UI Elements
- `<Loader>` / `<Spinner>` - Loading indicators
- `<EmptyState>` - Empty state placeholders
- `<Modal>` - Dialog modals
- `<Tooltip>` - Tooltips
- `<Typography>` - Text styling

All using the **Calimero design tokens** (`@calimero-network/mero-tokens`) with the brand accent color `#A5FF11`.

---

**Next:** Implement Application Summary screen using design system components! 🚀

