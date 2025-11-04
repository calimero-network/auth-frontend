import React, { useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { EnsureAdminSession } from './components/auth/EnsureAdminSession';
import { AdminFlow } from './flows/AdminFlow';
import { PackageFlow } from './flows/PackageFlow';
import { ApplicationFlow } from './flows/ApplicationFlow';
import { useFlowDetection } from './hooks/useFlowDetection';
import { handleUrlParams } from './utils/urlParams';
import { setAppEndpointKey } from '@calimero-network/calimero-client';

/**
 * App - Main entry point for auth-frontend
 * 
 * Orchestrates the complete OAuth-like authorization flow:
 * 1. Parse URL parameters to detect flow type
 * 2. Ensure auth-frontend has admin token (EnsureAdminSession)
 * 3. Route to appropriate flow based on URL params
 * 4. Flow generates scoped token for external app
 * 5. Redirect to callbackUrl with tokens in hash
 */
function App() {
  const flowParams = useFlowDetection();

  useEffect(() => {
    // Process URL parameters on mount
    handleUrlParams();
    
    // Auth frontend runs on the node's domain
    if (flowParams.appUrl) {
      setAppEndpointKey(flowParams.appUrl);
    }
  }, [flowParams.appUrl]);

  return (
    <ThemeProvider>
      <EnsureAdminSession>
        {flowParams.source === 'admin' && (
          <AdminFlow />
        )}
        
        {flowParams.source === 'package' && (
          <PackageFlow
            mode={flowParams.mode}
            packageName={flowParams.packageName!}
            packageVersion={flowParams.packageVersion}
            registryUrl={flowParams.registryUrl}
          />
        )}
        
        {flowParams.source === 'application-id' && (
          <ApplicationFlow
            mode={flowParams.mode}
            applicationId={flowParams.applicationId!}
            applicationPath={flowParams.applicationPath!}
          />
        )}
      </EnsureAdminSession>
    </ThemeProvider>
  );
}

export default App;
