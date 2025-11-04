# Registry Configuration Guide

This document explains how to configure the auth-frontend to use different registry URLs for local development vs production.

---

## 🎯 Overview

The auth-frontend can fetch application manifests from:
- **Local registry** (`http://localhost:8082`) for development
- **Production registry** (`https://mero-registry.vercel.app/api`) for production deployments

---

## 📁 Environment Files

### `.env.development` (Default for `pnpm dev`)
```bash
VITE_REGISTRY_URL=http://localhost:8082
```

Used when running `pnpm dev`. Points to your local registry server.

### `.env.production` (Default for `pnpm build`)
```bash
VITE_REGISTRY_URL=https://mero-registry.vercel.app/api
```

Used when building for production. Points to the remote Vercel registry.

---

## 🚀 Usage Scenarios

### Scenario 1: Local Development with Local Registry

```bash
# Terminal 1: Start local registry
cd registry
pnpm --filter registry-cli local start -p 8082

# Terminal 2: Start auth-frontend
cd auth-frontend
pnpm dev
```

**Result:** Uses `http://localhost:8082` (from `.env.development`)

---

### Scenario 2: Test Production Registry Locally

```bash
cd auth-frontend
VITE_REGISTRY_URL=https://mero-registry.vercel.app/api pnpm dev
```

**Result:** Uses production registry while developing locally

---

### Scenario 3: Production Build

```bash
cd auth-frontend
pnpm build
```

**Result:** Build uses `https://mero-registry.vercel.app/api` (from `.env.production`)

---

### Scenario 4: Custom Registry URL

```bash
cd auth-frontend
VITE_REGISTRY_URL=https://my-custom-registry.com/api pnpm dev
```

**Result:** Uses your custom registry URL

---

## 🔍 How It Works

### 1. URL Priority

The `RegistryClient` class resolves the registry URL in this order:

```typescript
constructor(baseUrl?: string) {
  this.baseUrl = baseUrl ||                        // 1. Explicitly passed
                 import.meta.env.VITE_REGISTRY_URL || // 2. Environment variable
                 'http://localhost:8082';          // 3. Default fallback
}
```

### 2. Runtime Override

Users can also pass `registry-url` as a URL parameter:

```
http://localhost:3000/auth?package-name=network.calimero.meropass&registry-url=https://custom-registry.com/api
```

This allows per-request registry overrides without changing the configuration.

---

## 📦 Installing Applications

### From Local Registry

**URL:**
```
http://localhost:3000/auth?package-name=network.calimero.meropass&package-version=0.1.1
```

**Fetch Flow:**
1. Auth frontend uses `VITE_REGISTRY_URL=http://localhost:8082`
2. Fetches manifest from `http://localhost:8082/apps/network.calimero.meropass/0.1.1`
3. Downloads WASM from manifest's `artifact.uri`
4. Installs app on node

---

### From Production Registry

**URL:**
```
https://your-node.com/auth?package-name=network.calimero.meropass
```

**Fetch Flow:**
1. Auth frontend uses `VITE_REGISTRY_URL=https://mero-registry.vercel.app/api`
2. Fetches manifest from `https://mero-registry.vercel.app/api/apps/network.calimero.meropass` (latest)
3. Downloads WASM from GitHub releases (from manifest)
4. Installs app on node

---

### With Custom Registry

**URL:**
```
http://localhost:3000/auth?package-name=my.app&registry-url=https://custom-registry.com/api
```

**Fetch Flow:**
1. Auth frontend uses the custom registry from URL parameter
2. Fetches manifest from custom registry
3. Proceeds with installation

---

## 🧪 Testing

### Test Local Registry

```bash
# 1. Start local registry
cd registry
pnpm --filter registry-cli local start

# 2. Submit a test app
pnpm --filter registry-cli apps submit manifest.json --local

# 3. Test auth frontend
cd auth-frontend
pnpm dev

# 4. Visit
open "http://localhost:3000/auth?package-name=network.calimero.meropass"
```

### Test Production Registry

```bash
cd auth-frontend
VITE_REGISTRY_URL=https://mero-registry.vercel.app/api pnpm dev

# Visit with production registry
open "http://localhost:3000/auth?package-name=network.calimero.meropass"
```

---

## 🐛 Troubleshooting

### Issue: "Package not found in registry"

**Cause:** Registry URL is pointing to wrong server or app isn't published

**Solution:**
```bash
# Check registry URL
echo $VITE_REGISTRY_URL

# Test registry directly
curl http://localhost:8082/apps

# Or for production
curl https://mero-registry.vercel.app/api/apps
```

---

### Issue: CORS errors in browser console

**Cause:** Registry server doesn't allow auth-frontend origin

**Local registry solution:**
Local registry should automatically allow `http://localhost:3000`

**Production registry solution:**
Add your node's domain to Vercel's CORS configuration

---

### Issue: Environment variable not loading

**Cause:** Vite needs restart after `.env` changes

**Solution:**
```bash
# Kill dev server (Ctrl+C)
pnpm dev  # Restart
```

---

## 📊 Environment Variable Reference

| Variable | Development | Production | Override |
|----------|------------|------------|----------|
| `VITE_REGISTRY_URL` | `http://localhost:8082` | `https://mero-registry.vercel.app/api` | `VITE_REGISTRY_URL=... pnpm dev` |

---

## ✅ Verification

After configuration, verify it works:

```bash
# 1. Check environment is loaded
cd auth-frontend
pnpm dev

# 2. In browser console:
# Open http://localhost:3000/auth
# Check network tab for registry requests
# Should see requests to the configured registry URL

# 3. Test installation
# Visit: http://localhost:3000/auth?package-name=network.calimero.meropass
# Should successfully fetch manifest and install app
```

---

## 🔗 Related Documentation

- **Registry API:** `/registry/packages/backend/V1_API_SPECIFICATION.md`
- **Package Naming:** `/PACKAGE_NAMING.md`
- **Local Registry:** `/registry/packages/cli/README.md#local-registry-for-development`

---

**Last Updated:** 2025-11-04  
**Status:** ✅ Implemented and tested

