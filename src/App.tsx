import React, { useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { EnsureAdminSession } from './components/auth/EnsureAdminSession';
import { AdminFlow } from './flows/AdminFlow';
import { PackageFlow } from './flows/PackageFlow';
import { ApplicationFlow } from './flows/ApplicationFlow';
import { useFlowDetection } from './hooks/useFlowDetection';
import { handleUrlParams } from './utils/urlParams';

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
  // CRITICAL: Process URL params SYNCHRONOUSLY before flow detection
  // This clears conflicting localStorage and stores new params
  // Must run before useFlowDetection() to avoid race condition
  React.useLayoutEffect(() => {
    handleUrlParams();
  }, []);
  
  const flowParams = useFlowDetection();

  // Auth frontend doesn't need to set app endpoint
  // It uses auth endpoint (set in urlParams) for admin API calls

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
