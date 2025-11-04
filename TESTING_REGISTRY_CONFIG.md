# Testing Registry Configuration

Quick testing guide to verify the registry configuration works correctly.

---

## 🧪 Test 1: Local Registry (Default)

```bash
# Terminal 1: Start local registry
cd /Users/xilosada/dev/calimero/registry
pnpm --filter registry-cli local start -p 8082

# Terminal 2: Submit meropass to local registry
cd /Users/xilosada/dev/calimero/registry
pnpm --filter registry-cli apps submit ../meropass/manifest.json --local

# Terminal 3: Start auth-frontend
cd /Users/xilosada/dev/calimero/auth-frontend
pnpm dev
```

**Test URL:**
```
http://localhost:3000/auth?package-name=network.calimero.meropass
```

**Expected:**
- ✅ Manifest fetched from `http://localhost:8082/apps/network.calimero.meropass`
- ✅ Console shows: "Fetching manifest from registry for package: network.calimero.meropass@latest"
- ✅ WASM downloaded from local artifact URL
- ✅ App installed successfully

**Verify in Browser Console:**
```javascript
// Should see network request to:
// http://localhost:8082/apps/network.calimero.meropass
```

---

## 🧪 Test 2: Production Registry (Override)

```bash
cd /Users/xilosada/dev/calimero/auth-frontend
VITE_REGISTRY_URL=https://mero-registry.vercel.app/api pnpm dev
```

**Test URL:**
```
http://localhost:3000/auth?package-name=network.calimero.meropass
```

**Expected:**
- ✅ Manifest fetched from `https://mero-registry.vercel.app/api/apps/network.calimero.meropass`
- ✅ WASM downloaded from GitHub releases
- ✅ App installed successfully

**Verify in Browser Console:**
```javascript
// Should see network request to:
// https://mero-registry.vercel.app/api/apps/network.calimero.meropass
```

---

## 🧪 Test 3: Custom Registry via URL Parameter

```bash
cd /Users/xilosada/dev/calimero/auth-frontend
pnpm dev
```

**Test URL:**
```
http://localhost:3000/auth?package-name=network.calimero.meropass&registry-url=https://mero-registry.vercel.app/api
```

**Expected:**
- ✅ Manifest fetched from custom URL in parameter
- ✅ Overrides default environment variable
- ✅ App installed successfully

---

## 🧪 Test 4: Check Environment Loading

```bash
cd /Users/xilosada/dev/calimero/auth-frontend

# Test development
echo "Testing .env.development..."
pnpm dev &
sleep 5
# Check browser console for registry URL

# Test production build
echo "Testing .env.production..."
pnpm build
# Check build output for registry URL
```

**Verify:**
```bash
# In dev mode, check what URL is being used:
# Open browser console and type:
# (Look at network requests to see which registry is being called)
```

---

## 🧪 Test 5: Production Build

```bash
cd /Users/xilosada/dev/calimero/auth-frontend

# Build with production config
pnpm build

# Check build uses production registry
grep -r "mero-registry.vercel.app" build/
```

**Expected:**
- ✅ Build completes successfully
- ✅ Uses production registry URL in bundle
- ✅ No localhost references in production build

---

## 📊 Quick Verification Checklist

- [ ] `.env.development` exists with `VITE_REGISTRY_URL=http://localhost:8082`
- [ ] `.env.production` exists with `VITE_REGISTRY_URL=https://mero-registry.vercel.app/api`
- [ ] `.env` files are in `.gitignore`
- [ ] `registryClient.ts` uses `import.meta.env.VITE_REGISTRY_URL`
- [ ] Local dev mode fetches from localhost:8082
- [ ] Environment variable override works: `VITE_REGISTRY_URL=... pnpm dev`
- [ ] URL parameter override works: `?registry-url=...`
- [ ] Production build uses Vercel registry

---

## 🐛 Common Issues

### Issue: Still using localhost:8082 in production build

**Cause:** Environment file not loaded during build

**Solution:**
```bash
# Ensure .env.production exists and contains correct URL
cat .env.production

# Rebuild
pnpm build
```

---

### Issue: Changes not reflected after editing .env

**Cause:** Vite doesn't hot-reload environment variables

**Solution:**
```bash
# Restart dev server
# Press Ctrl+C to kill
pnpm dev
```

---

### Issue: Package not found in registry

**Cause:** Registry doesn't have the package or wrong URL

**Solution:**
```bash
# Test registry directly
curl http://localhost:8082/apps

# Or for production
curl https://mero-registry.vercel.app/api/apps
```

---

## ✅ Success Criteria

All tests pass when:

1. ✅ Local dev uses local registry by default
2. ✅ Production build uses production registry
3. ✅ Environment override works: `VITE_REGISTRY_URL=... pnpm dev`
4. ✅ URL parameter override works
5. ✅ Meropass installs successfully from both registries
6. ✅ No .env files appear in `git status` (they're gitignored)
7. ✅ Console shows correct registry URL in network requests

---

**Last Updated:** 2025-11-04  
**Status:** ✅ Ready for testing

