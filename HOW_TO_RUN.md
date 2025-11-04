# How to Run Auth-Frontend with Registry Configuration

This guide explains how the `VITE_REGISTRY_URL` environment variable works in different scenarios.

---

## 🔑 **Key Concept: Build-Time vs Runtime**

**IMPORTANT:** `VITE_REGISTRY_URL` is a **BUILD-TIME** variable, not a runtime variable!

- Vite reads `.env` files **when you build** the frontend
- The variable value gets **embedded into the JavaScript bundle**
- You cannot change it after the build without rebuilding

---

## 📋 **Three Usage Scenarios**

### **Scenario 1: Local Development (No Docker)** ⭐ MOST COMMON

**When to use:** Developing and testing locally

```bash
# Terminal 1: Start local registry
cd /Users/xilosada/dev/calimero/registry
pnpm --filter registry-cli local start -p 8082

# Terminal 2: Start auth-frontend with hot reload
cd /Users/xilosada/dev/calimero/auth-frontend
pnpm dev  # ← Automatically uses .env.development
```

**What happens:**
- ✅ Vite reads `.env.development` → `VITE_REGISTRY_URL=http://localhost:8082`
- ✅ Opens at `http://localhost:3000/auth`
- ✅ Supports hot reload (changes update instantly)
- ✅ Connects to local registry

**Test it:**
```
http://localhost:3000/auth?package-name=network.calimero.meropass
```

---

### **Scenario 2: Test Production Registry Locally**

**When to use:** Testing how your app will behave with the production registry

```bash
cd /Users/xilosada/dev/calimero/auth-frontend

# Override the registry URL at dev time
VITE_REGISTRY_URL=https://mero-registry.vercel.app/api pnpm dev
```

**What happens:**
- ✅ Environment variable **overrides** `.env.development`
- ✅ Connects to production Vercel registry
- ✅ Still runs locally with hot reload
- ✅ Useful for testing without building Docker

**Test it:**
```
http://localhost:3000/auth?package-name=network.calimero.meropass
```

---

### **Scenario 3: Production Docker Image**

**When to use:** Building a Docker image for deployment

#### Step 1: Build Frontend with Production Registry

```bash
cd /Users/xilosada/dev/calimero/auth-frontend

# Build uses .env.production automatically
pnpm build

# Output goes to: build/
```

**What happens:**
- ✅ Vite reads `.env.production` → `VITE_REGISTRY_URL=https://mero-registry.vercel.app/api`
- ✅ Creates optimized production bundle in `build/`
- ✅ Registry URL is **baked into** the JavaScript files

#### Step 2: Build Docker Image with Frontend Embedded

```bash
cd /Users/xilosada/dev/calimero/auth-frontend

# Build Docker image that embeds the built frontend
docker build \
  -f Dockerfile.auth.rebuild \
  -t my-custom-auth:latest \
  .
```

**What happens:**
- ✅ Docker copies `build/` directory into image
- ✅ Rust `mero-auth` binary embeds the frontend files
- ✅ Final image includes auth service + frontend

#### Step 3: Run the Docker Container

```bash
# Run the auth service (frontend is already embedded)
docker run -p 3001:3001 my-custom-auth:latest
```

**Access at:** `http://localhost:3001/auth`

---

## 🏗️ **Running Full Calimero Node with Auth Service**

### **Option A: Using Merobox (Recommended)**

```bash
cd /Users/xilosada/dev/calimero

# Run node with auth service enabled
merobox run \
  --auth-service \
  --count 1
```

**What happens:**
- ✅ Merobox starts Calimero node
- ✅ Starts auth service container automatically
- ✅ Sets up Traefik proxy
- ✅ Auth available at `http://localhost/auth`

**Using custom auth image:**
```bash
# After building your custom auth image (from Scenario 3)
merobox run \
  --auth-service \
  --auth-image my-custom-auth:latest \
  --count 1
```

### **Option B: Manual Docker Compose**

```bash
cd /Users/xilosada/dev/calimero/core

# Start node + auth service
docker-compose -f docker-compose.auth.yml up
```

---

## 🔄 **When to Rebuild**

You need to rebuild when:

### **Need to Rebuild Frontend** (`pnpm build`)
- ✅ Changed registry URL in `.env.production`
- ✅ Changed any frontend code
- ✅ Updated dependencies

### **Need to Rebuild Docker Image**
- ✅ After rebuilding frontend
- ✅ Want to deploy with new registry URL
- ✅ Updated auth service code

### **DON'T Need to Rebuild**
- ❌ Testing locally with `pnpm dev` (uses live reload)
- ❌ Just want to test different registry URL (use env var override)

---

## 🎯 **Quick Reference Table**

| Scenario | Command | Registry URL Source | Hot Reload? |
|----------|---------|---------------------|-------------|
| **Local Dev** | `pnpm dev` | `.env.development` | ✅ Yes |
| **Test Prod Registry** | `VITE_REGISTRY_URL=... pnpm dev` | Environment variable | ✅ Yes |
| **Build Frontend** | `pnpm build` | `.env.production` | ❌ No |
| **Docker Image** | `docker build ...` | Embedded in build | ❌ No |

---

## 🐛 **Common Issues**

### Issue: "Still using old registry URL after changing .env"

**In development mode (`pnpm dev`):**
```bash
# Restart dev server
# Press Ctrl+C, then:
pnpm dev
```

**In production mode (Docker):**
```bash
# Must rebuild everything
cd auth-frontend
pnpm build  # ← This reads .env.production
docker build -f Dockerfile.auth.rebuild -t my-custom-auth:latest .
```

### Issue: "Can't change registry URL in Docker container"

**Cause:** Registry URL is baked into the JavaScript bundle at build time.

**Solution:** You must rebuild:
1. Edit `.env.production`
2. Run `pnpm build`
3. Rebuild Docker image
4. Restart container

---

## 💡 **Pro Tips**

### Tip 1: Quick Test Without Docker

```bash
# Test both registries without Docker
cd auth-frontend

# Test local
pnpm dev  # Opens at localhost:3000

# Test production (in new terminal)
VITE_REGISTRY_URL=https://mero-registry.vercel.app/api pnpm dev --port 3001
```

### Tip 2: Override Registry at Build Time

```bash
# Build with custom registry
cd auth-frontend
VITE_REGISTRY_URL=https://my-custom-registry.com/api pnpm build
```

### Tip 3: Verify Build Output

```bash
# Check what registry URL is embedded
cd auth-frontend
grep -r "mero-registry" build/
# Should show the URL from .env.production
```

---

## 📚 **Related Documentation**

- **REGISTRY_CONFIGURATION.md** - Complete configuration guide
- **TESTING_REGISTRY_CONFIG.md** - Testing procedures
- **core/crates/auth/README.md** - Auth service documentation

---

**Last Updated:** 2025-11-04  
**Status:** ✅ Ready to use

