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
│   ├── auth/           # Authentication components
│   ├── common/         # Shared UI components
│   ├── context/        # Context management
│   ├── permissions/    # Permission handling
│   ├── providers/      # Provider selection
│   └── session/        # Session management
├── hooks/              # Custom React hooks
├── theme/              # Styling and theme configuration
└── utils/              # Utility functions
```

## Key Components

### Authentication
- **LoginView**: User authentication interface
- **SessionPrompt**: Session management prompts

### Context Management
- **ContextSelector**: Interface for selecting contexts
- **useContextCreation**: Hook for creating new contexts
- **useContextSelection**: Hook for context selection logic

### Permissions
- **PermissionsView**: User permissions management interface

### Providers
- **ProviderSelector**: Interface for choosing authentication providers

## Dependencies

### Core Dependencies
- **@calimero-network/calimero-client**: Calimero Network integration
- **@near-wallet-selector**: NEAR wallet connection and management
- **near-api-js**: NEAR Protocol JavaScript API
- **react-router-dom**: Client-side routing

### Styling
- **@emotion/react** & **@emotion/styled**: CSS-in-JS styling
- **styled-components**: Component styling

## Browser Support

This application uses modern JavaScript features and supports:
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
