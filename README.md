# Auth Frontend

A React TypeScript frontend application for authentication and context management with Calimero Network integration.

## Features

- 🔐 **Authentication System** - User login frontend logic implementation
- 🎛️ **Context Management** - Create and/or select contexts
- 🛡️ **Permissions Management** - Handle user permissions and access control

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Emotion, Styled Components
- **Package Manager**: pnpm
- **Routing**: React Router DOM

## Prerequisites

- Node.js (v18 or higher)
- pnpm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd auth-frontend
```

2. Install dependencies:
```bash
pnpm install
```

## Development

Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## Build

Create a production build:
```bash
pnpm build
```

Preview the production build:
```bash
pnpm preview
```

## Project Structure

```
src/
├── components/
│   ├── applications/   # ApplicationInstallCheck
│   ├── auth/           # EnsureAdminSession, UsernamePasswordForm
│   ├── common/         # Shared UI (Loader, ErrorView, PageShell, Layout)
│   ├── context/        # ContextSelector
│   ├── manifest/       # ManifestProcessor
│   ├── permissions/    # PermissionsView
│   └── providers/      # ProviderSelector
├── flows/              # AdminFlow, ApplicationFlow, PackageFlow
├── hooks/              # useFlowDetection, useContextCreation, useContextSelection
├── lib/                # mero.ts — MeroJs singleton + generateClientKeyDirect
├── theme/              # Styling and theme configuration
├── types/              # flows.ts — AppMode, FlowSource, FlowDetectionResult
└── utils/              # urlParams, permissions, registryClient
```

## Key Components

### Authentication
- **EnsureAdminSession**: Wraps all flows — validates or obtains admin tokens before rendering children
- **UsernamePasswordForm**: Login form used by EnsureAdminSession

### Flows
- **AdminFlow**: Permission review + admin token generation
- **ApplicationFlow**: App install check → permissions → context selection → redirect
- **PackageFlow**: Manifest fetch + install → permissions → context selection → summary → redirect

### Context Management
- **ContextSelector**: Lists and creates contexts; used in single-context mode only
- **useContextCreation**: Hook for creating contexts via `mero.admin.createContext()`
- **useContextSelection**: Hook for fetching contexts and identities

### Permissions
- **PermissionsView**: Per-permission risk cards; adapts to admin vs application mode

### Manifest
- **ManifestProcessor**: Fetches manifest from registry, detects existing installs, triggers `mero.admin.installApplication()`

## Dependencies

### Core Dependencies
- **@calimero-network/mero-js**: Calimero Network JavaScript SDK
- **@near-wallet-selector**: NEAR wallet connection and management
- **near-api-js**: NEAR Protocol JavaScript API
- **react-router-dom**: Client-side routing

### Styling
- **@emotion/react** & **@emotion/styled**: CSS-in-JS styling
- **styled-components**: Component styling

## Package-Based Authentication

The auth service supports package-based application resolution using the Calimero registry.

### URL Parameters

#### Package Name (Recommended)
```
https://auth.calimero.network/auth/login?
  package-name=network.calimero.meropass&
  package-version=1.0.0&
  callback-url=https://app.example.com/callback&
  permissions=context:execute,application
```

#### Manifest URL (Direct)
```
https://auth.calimero.network/auth/login?
  manifest-url=http://localhost:8082/apps/network.calimero.meropass/1.0.0&
  callback-url=https://app.example.com/callback&
  permissions=context:execute,application
```

#### Application ID (Legacy)
```
https://auth.calimero.network/auth/login?
  application-id=4WEikdan9yeaDTADsS1uGzGasiVuJDQcozJbogEyTYcy&
  callback-url=https://app.example.com/callback&
  permissions=context:execute,application
```

### Environment Variables

Create a `.env` file for configuration:

```bash
# Registry URL (defaults to http://localhost:8082)
VITE_REGISTRY_URL=http://localhost:8082

# For official registry (future):
# VITE_REGISTRY_URL=https://registry.calimero.network
```

### How It Works

1. Client redirects to auth service with `package-name` parameter
2. Auth service fetches manifest from registry
3. Auth service checks if app is installed on node
4. If not installed, downloads WASM from manifest's artifact URL
5. Node installs application with package metadata
6. Auth service creates JWT with resolved application ID
7. User is redirected back with access token

### Manifest Components

The auth service processes manifests with these fields:

- **ManifestProcessor**: Fetches manifest from registry by package name
- **PackageInstallFlow**: Handles installation from registry artifact URL

See [PACKAGE_NAMING.md](../PACKAGE_NAMING.md) for complete documentation.

## Browser Support

This application uses modern JavaScript features and supports:
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
