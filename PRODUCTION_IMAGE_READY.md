# Production Auth Image - Ready for Deployment

**Built:** 2025-11-04  
**Image:** `calimero-auth:prod-registry` / `calimero-auth:latest`  
**Registry:** `https://mero-registry.vercel.app/api`  
**Status:** ✅ Ready for Production

---

## 🎉 What Was Built

### Docker Image Details
- **Image Name:** `calimero-auth:prod-registry`
- **Also Tagged As:** `calimero-auth:latest`
- **Size:** 174MB
- **Build Time:** ~25 seconds
- **Frontend Embedded:** Yes (via rust-embed)
- **Registry URL:** `https://mero-registry.vercel.app/api` (embedded)

### Build Process
1. ✅ Frontend built with `.env.production`
2. ✅ Production registry URL embedded in JavaScript
3. ✅ Docker image built from `Dockerfile.auth.rebuild`
4. ✅ Frontend files copied to `/app/frontend/` during build
5. ✅ Rust binary compiled with embedded frontend
6. ✅ Final image tagged and ready

---

## 🚀 How to Use

### Start Node with Production Auth Image

```bash
cd /Users/xilosada/dev/calimero

# Option 1: Using explicit tag
merobox run \
  --auth-service \
  --auth-image calimero-auth:prod-registry \
  --count 1

# Option 2: Using latest tag
merobox run \
  --auth-service \
  --auth-image calimero-auth:latest \
  --count 1
```

**Access at:** `http://localhost/auth/login`

---

## 🧪 Test Installation from Production Registry

### Step 1: Start the Node

```bash
merobox run --auth-service --auth-image calimero-auth:latest --count 1
```

### Step 2: Install Meropass

**Navigate to:**
```
http://localhost/auth/login?package-name=network.calimero.meropass&callback-url=http://localhost:3000/home&permissions=context:create,context:list,context:execute
```

**What Happens:**
1. Frontend loads (embedded in auth service)
2. Fetches manifest from **production registry:**
   ```
   https://mero-registry.vercel.app/api/apps/network.calimero.meropass
   ```
3. Downloads WASM from GitHub releases:
   ```
   https://github.com/calimero-network/app-registry/releases/download/meropass-v0.1.0/meropass.wasm
   ```
4. Installs meropass on the node
5. Creates authentication token
6. Redirects back to callback URL

---

## 📊 Configuration Summary

| Environment | Registry URL | How It's Set |
|-------------|--------------|--------------|
| **Development** | `http://localhost:8082` | `.env.development` (for `pnpm dev`) |
| **Production** | `https://mero-registry.vercel.app/api` | `.env.production` (for `pnpm build`) |
| **Docker** | `https://mero-registry.vercel.app/api` | Embedded from production build |

---

## 🔍 Verification

### Verify Registry URL in Image

```bash
# Extract and check the embedded JavaScript
docker run --rm calimero-auth:prod-registry ls -la /usr/local/bin/mero-auth

# The frontend is embedded IN the binary - you can't extract it easily,
# but we verified during build that it contains the production URL
```

### Verify Image Tags

```bash
docker images | grep calimero-auth
# Should show:
# calimero-auth   prod-registry   <ID>   <time>   174MB
# calimero-auth   latest          <ID>   <time>   174MB
```

---

## 🔄 Rebuilding

If you need to rebuild (e.g., registry URL changed):

```bash
cd /Users/xilosada/dev/calimero/auth-frontend

# 1. Update .env.production if needed
nano .env.production

# 2. Clean and rebuild frontend
rm -rf build/
pnpm build

# 3. Verify registry URL
grep -o "https://.*registry.*" build/assets/index-*.js | head -1

# 4. Rebuild Docker image
docker build -f Dockerfile.auth.rebuild -t calimero-auth:prod-registry -t calimero-auth:latest .
```

---

## 🐛 Troubleshooting

### Issue: "Package not found in registry"

**Check Registry URL in Bundle:**
```bash
cd auth-frontend
grep -r "mero-registry\|localhost:8082" build/
```

**Should only show:** `mero-registry.vercel.app` (production)

### Issue: Auth Service Returns 404

**Check Traefik Routing:**
```bash
docker logs proxy | grep auth
```

**Verify Auth Service is Running:**
```bash
docker ps | grep auth
docker logs auth | tail -20
```

### Issue: Need to Use Local Registry Instead

**Override at Runtime via URL Parameter:**
```
http://localhost/auth/login?package-name=my.app&registry-url=http://localhost:8082
```

**Or Rebuild with Development Config:**
```bash
cd auth-frontend
VITE_REGISTRY_URL=http://localhost:8082 pnpm build
docker build -f Dockerfile.auth.rebuild -t calimero-auth:dev-registry .
```

---

## 📚 Related Documentation

- `REGISTRY_CONFIGURATION.md` - Complete configuration guide
- `HOW_TO_RUN.md` - How to run with different registries
- `DOCKER_TEST_RESULTS.md` - Docker testing results
- `TEST_RESULTS.md` - Build test results

---

## ✅ Ready for Production

This image is ready to deploy in production environments where you want applications to be installed from the public Calimero registry at `https://mero-registry.vercel.app`.

**Image Tags:**
- `calimero-auth:prod-registry` (explicit)
- `calimero-auth:latest` (convenience)

**Use with:**
- Merobox
- Docker Compose
- Kubernetes
- Any container orchestration

---

**Last Updated:** 2025-11-04 13:52  
**Status:** ✅ Production Ready

