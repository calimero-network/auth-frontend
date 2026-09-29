import React, { useMemo } from 'react';
import { EnsureAdminSession } from './components/auth/EnsureAdminSession';
import { AdminFlow } from './flows/AdminFlow';
import { PackageFlow } from './flows/PackageFlow';
import { ApplicationFlow } from './flows/ApplicationFlow';
import { useFlowDetection } from './hooks/useFlowDetection';
import { ErrorView } from './components/common/ErrorView';
import { findRejectedNodeUrl, handleUrlParams } from './utils/urlParams';

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
  // Checked during render, so a rejected link stops before any effect can send.
  const rejectedNodeUrl = useMemo(findRejectedNodeUrl, []);

  // CRITICAL: Process URL params SYNCHRONOUSLY before flow detection
  // This clears conflicting localStorage and stores new params
  // Must run before useFlowDetection() to avoid race condition
  React.useLayoutEffect(() => {
    if (!rejectedNodeUrl) handleUrlParams();
  }, [rejectedNodeUrl]);
  
  const flowParams = useFlowDetection();

  if (rejectedNodeUrl) {
    return (
      <ErrorView
        message={`This login link points the page at ${rejectedNodeUrl}, but only the node serving it (${window.location.origin}) is accepted. Nothing was sent.`}
        hint="If you did not expect this link, close this tab."
        buttonText="Continue on this node"
        onRetry={() => window.location.assign(window.location.pathname)}
      />
    );
  }

  // Auth frontend doesn't need to set app endpoint
  // It uses auth endpoint (set in urlParams) for admin API calls

  return (
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
  );
}

export default App;
