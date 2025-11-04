# LocalStorage Issue - Manifest URL

## ⚠️ Problem

When testing, you might see the auth frontend trying to fetch from:
```
http://localhost:8082/apps/network.calimero.meropass/1.0.0
```

Even though the production registry URL (`https://mero-registry.vercel.app/api`) is correctly embedded in the Docker image.

---

## 🔍 Root Cause

The `ManifestProcessor` component checks localStorage for `manifest-url` first:

```typescript
// From ManifestProcessor.tsx line 59-66:
if (manifestUrl) {
  // If manifest-url exists in localStorage, use it directly
  const response = await fetch(manifestUrl);
  setManifest(await response.json());
} else if (packageName) {
  // Otherwise, use registryClient to fetch from configured registry
  const client = registryUrl ? 
    new RegistryClient(registryUrl) : 
    registryClient;  // ← This uses the production URL
}
```

**Priority:**
1. `manifest-url` from localStorage (if exists) ← **THIS IS THE PROBLEM**
2. `registryClient` with `package-name`

---

## ✅ Solutions

### Solution 1: Clear Browser Storage (Quick Fix)

**In Browser:**
1. Open DevTools (F12)
2. Go to Application tab → Storage → Local Storage
3. Click "Clear All"
4. Refresh page

**Or via Console:**
```javascript
localStorage.clear();
location.reload();
```

### Solution 2: Use Incognito/Private Window

```
Open: http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=...
```

In incognito mode, there's no localStorage pollution.

### Solution 3: Use Different Browser

If you've been testing in Chrome, try Firefox/Safari with fresh localStorage.

### Solution 4: Don't Pass manifest-url (Only package-name)

**Correct URL (uses registryClient):**
```
http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**Incorrect URL (bypasses registryClient):**
```
http://localhost/auth/login?manifest-url=http://localhost:8082/apps/...&callback-url=...
```

---

## 🧪 How to Test Production Registry

### Method 1: Fresh Browser Session

```bash
# Start with fresh localStorage
1. Open incognito window
2. Visit: http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
3. Check Network tab - should see requests to mero-registry.vercel.app
```

### Method 2: Clear and Test

```bash
# In browser console:
localStorage.clear();
window.location.href = 'http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute';
```

### Method 3: Verify Registry Client is Working

```javascript
// In browser console after page loads:
console.log('Registry base URL:', 
  import.meta.env.VITE_REGISTRY_URL || 'http://localhost:8082'
);
```

Should show: `https://mero-registry.vercel.app/api`

---

## 🔍 How to Verify It's Using Production Registry

### Check Network Requests

In browser DevTools → Network tab, you should see:

**✅ Correct (Production):**
```
GET https://mero-registry.vercel.app/api/apps/network.calimero.meropass
```

**❌ Incorrect (Old localStorage):**
```
GET http://localhost:8082/apps/network.calimero.meropass/1.0.0
```

---

## 🐛 Why This Happens

1. Previous testing stored `manifest-url` in localStorage
2. localStorage persists across sessions
3. ManifestProcessor checks for `manifest-url` BEFORE `package-name`
4. Old URL gets used even though new build has correct URL

---

## 💡 Code Fix (Optional)

If you want to prioritize `package-name` over old `manifest-url`, you could update the code:

**Current behavior:**
```typescript
if (manifestUrl) {
  // Use old localStorage value
} else if (packageName) {
  // Use registryClient
}
```

**Better behavior:**
```typescript
if (packageName) {
  // Always prefer package-name (uses configured registry)
} else if (manifestUrl) {
  // Fall back to direct manifest URL
}
```

But for now, just **clear localStorage** and it will work!

---

## ✅ Expected Behavior After localStorage Clear

**URL:**
```
http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**Network Request:**
```
GET https://mero-registry.vercel.app/api/apps/network.calimero.meropass
→ Returns manifest with v0.1.1 (latest)
```

**WASM Download:**
```
GET https://github.com/calimero-network/app-registry/releases/download/meropass-v0.1.0/meropass.wasm
→ Downloads 266KB WASM file
```

**Result:**
```
Meropass installed from production registry! ✅
```

---

**Quick Fix:** Clear browser localStorage and reload!
