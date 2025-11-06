import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import ThemeProvider from './theme/ThemeProvider';

// Minimal polyfills needed for Buffer
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.Buffer.isBuffer = Buffer.isBuffer;
  // @ts-ignore - just the minimal process properties needed
  window.process = { env: {} };
  // @ts-ignore
  window.global = window;
}

// Enable MSW in development mode for testing without backend
async function enableMocking() {
  if (import.meta.env.MODE === 'development' && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      serviceWorker: {
        url: '/auth/mockServiceWorker.js',
      },
      onUnhandledRequest: 'bypass',
    });
    console.log('🎭 MSW enabled - API requests will be mocked');
    return;
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    // <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    // </React.StrictMode>,
  );
});