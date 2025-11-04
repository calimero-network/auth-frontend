# Simple Registry Usage - No More Build Hell!

**Status:** ✅ Fixed - One image works for all environments

---

## 🎉 The Problem is SOLVED

You no longer need to rebuild for different registries!

---

## 🚀 How It Works Now

### **One Docker Image for Everything**

```bash
# Build once
cd auth-frontend
pnpm build
docker build -f Dockerfile.auth.rebuild -t calimero-auth:latest .
```

### **Production (Default)**

```bash
# Just run - no parameters needed!
merobox run --auth-service --auth-image calimero-auth:latest

# Install meropass from production registry:
http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**Fetches from:** `https://mero-registry.vercel.app/api` ✅

### **Local Development (Override via URL)**

```bash
# Same Docker image!
merobox run --auth-service --auth-image calimero-auth:latest

# Add registry-url parameter:
http://localhost/auth/login?package-name=my.local.app&registry-url=http://localhost:8082&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**Fetches from:** `http://localhost:8082` ✅

---

## 🎯 Key Changes

### ✅ What Was Fixed

1. **Default Registry:** Production instead of localhost
   ```typescript
   // registryClient.ts defaults to:
   'https://mero-registry.vercel.app/api'
   ```

2. **registry-url Parameter:** Never stored in localStorage
   ```typescript
   // urlParams.ts:
   const doNotStore = ['registry-url']; // Transient only
   ```

3. **Priority:** package-name always takes precedence
   ```typescript
   // ManifestProcessor.tsx:
   if (packageName) {
     // Use registryClient with configured/default URL
   } else if (manifestUrl) {
     // Fall back to direct URL
   }
   ```

---

## 📊 Comparison

### ❌ Old Way (Terrible)
```bash
# For production:
cd auth-frontend
# Edit .env.production
pnpm build
docker build -t auth:prod .

# For local:
cd auth-frontend  
# Edit .env.development
pnpm build
docker build -t auth:dev .

# Two different images, lots of rebuilding 😡
```

### ✅ New Way (Simple)
```bash
# Build once:
cd auth-frontend
pnpm build
docker build -t calimero-auth:latest .

# Use everywhere:
merobox run --auth-service --auth-image calimero-auth:latest

# Production (default):
?package-name=network.calimero.meropass

# Local (override):
?package-name=my.app&registry-url=http://localhost:8082
```

**One image, runtime configuration! 🎉**

---

## 🧪 Testing

### Test Production Registry (Default)

```
http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**Check browser console:**
```
Fetching manifest from registry for package: network.calimero.meropass@latest
Registry client base URL: https://mero-registry.vercel.app/api
```

### Test Local Registry (Override)

```
http://localhost/auth/login?package-name=my.app&registry-url=http://localhost:8082&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**Check browser console:**
```
Registry client base URL: http://localhost:8082
```

---

## 💡 No More localStorage Issues!

- ✅ `registry-url` never persisted
- ✅ Read from URL params only
- ✅ No pollution between sessions
- ✅ No need to clear browser cache

---

## ✅ Summary

**Before:** Build different images for dev/prod  
**After:** One image + URL parameter

**Before:** Clear localStorage constantly  
**After:** Never stores registry-url

**Before:** Rebuild to switch registries  
**After:** Just add `?registry-url=...`

---

**Last Updated:** 2025-11-04  
**Status:** ✅ Production Ready - No More Build Hell!
