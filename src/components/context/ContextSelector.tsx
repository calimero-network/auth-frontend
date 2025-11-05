import { useEffect, useMemo, useState } from 'react';
import { useContextSelection } from '../../hooks/useContextSelection';
import { PROTOCOLS, PROTOCOL_DISPLAY, useContextCreation } from '../../hooks/useContextCreation';
import { getStoredUrlParam } from '../../utils/urlParams';
import Button from '../common/Button';
import { ErrorView } from '../common/ErrorView';
import { SelectContext, SelectContextIdentity } from '@calimero-network/calimero-client';
import { PermissionsView } from '../permissions/PermissionsView';
import {
  ContextSelectorWrapper,
} from './styles';
import { EmptyState } from '../common/styles';
import Loader from '../common/Loader';

interface ContextSelectorProps {
  onComplete: (contextId: string, identity: string) => void;
  onBack: () => void;
}

export function ContextSelector({ onComplete, onBack }: ContextSelectorProps) {
  const [showProtocolSelection, setShowProtocolSelection] = useState(false);

  const {
    contexts,
    selectedContext,
    identities,
    selectedIdentity,
    loading: selectionLoading,
    error: selectionError,
    fetchContexts,
    handleContextSelect,
    handleIdentitySelect,
  } = useContextSelection();

  const {
    isLoading: creationLoading,
    error: creationError,
    checkAndInstallApplication,
    setSelectedProtocol,
    selectedProtocol,
    showInstallPrompt,
    handleContextCreation,
    handleInstallCancel,
  } = useContextCreation();

  const permissions = useMemo(() => {
    const permissionsParam = getStoredUrlParam('permissions');
    return permissionsParam ? permissionsParam.split(',') : [];
  }, []);

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  // Filter contexts based on applicationId URL parameter
  const applicationId = getStoredUrlParam('application-id');
  const applicationPath = getStoredUrlParam('application-path');
  const installedApplicationId = sessionStorage.getItem('installed-application-id') || 
                                  localStorage.getItem('installed-application-id'); // Fallback
  const targetApplicationId = applicationId || installedApplicationId;
  
  const filteredContexts = useMemo(() => {
    if (!targetApplicationId) return contexts;
    return contexts.filter(context => context.applicationId === targetApplicationId);
  }, [contexts, targetApplicationId]);

  const loading = selectionLoading || creationLoading;
  const error = selectionError || creationError;

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ContextSelectorWrapper>
        <ErrorView 
          message={error} 
          onRetry={fetchContexts}
        />
      </ContextSelectorWrapper>
    );
  }

  // Show install prompt if there's an application mismatch
  if (showInstallPrompt) {
    return (
      <ContextSelectorWrapper>
        <EmptyState>
          <h2>Application ID Mismatch</h2>
          <p>The application ID doesn't match the actual application. Would you like to install it anyway?</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Button 
              onClick={handleInstallCancel}
              style={{ marginRight: '10px' }}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                const contextData = await handleContextCreation(applicationId || targetApplicationId);
                if (contextData) {
                  handleContextSelect(contextData.contextId);
                  handleIdentitySelect(contextData.contextId, contextData.memberPublicKey);
                }
              }}
              disabled={loading}
              primary
            >
              Install Anyway
            </Button>
          </div>
        </EmptyState>
      </ContextSelectorWrapper>
    );
  }

  // No contexts available and applicationPath is present - show create context prompt
  if (!filteredContexts.length && targetApplicationId && !selectedContext && !selectedIdentity) {
    return (
      <ContextSelectorWrapper>
        <EmptyState>
          <h2>Create New Context</h2>
          <p>There are no contexts for this application. Would you like to create a new context?</p>
          {!showProtocolSelection ? (
            <Button 
              onClick={() => setShowProtocolSelection(true)}
              primary
            >
              Create New Context
            </Button>
          ) : selectedProtocol ? (
            <>
              <p>Selected Protocol: {PROTOCOL_DISPLAY[selectedProtocol]}</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Button 
                  onClick={() => setSelectedProtocol(null)}
                  style={{ marginRight: '10px' }}
                >
                  Back
                </Button>
                <Button 
                  onClick={async () => {
                    if (applicationId && applicationPath) {
                      const success = await checkAndInstallApplication(applicationId, applicationPath);
                      if (!success) {
                        return;
                      }
                    }

                    const result = await handleContextCreation(targetApplicationId);
                    if (result) {
                      onComplete(result.contextId, result.memberPublicKey);
                    }
                  }}
                  disabled={loading}
                  primary
                >
                  {loading ? 'Creating...' : 'Create Context'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>Please select a protocol:</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
                {PROTOCOLS.map((protocol) => (
                  <Button
                    key={protocol}
                    onClick={() => setSelectedProtocol(protocol)}
                    style={{ margin: '5px' }}
                    primary
                  >
                    {PROTOCOL_DISPLAY[protocol]}
                  </Button>
                ))}
              </div>
              <Button 
                onClick={() => {
                  setShowProtocolSelection(false);
                }}
                style={{ marginTop: '10px' }}
              >
                Back
              </Button>
            </>
          )}
        </EmptyState>
      </ContextSelectorWrapper>
    );
  }

  return (
    <ContextSelectorWrapper>
      {/* Create New Context Flow */}
      {showProtocolSelection && !selectedContext && (
        <EmptyState>
          <h2>Create New Context</h2>
          {selectedProtocol ? (
            <>
              <p>Selected Protocol: {PROTOCOL_DISPLAY[selectedProtocol]}</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Button 
                  onClick={() => setSelectedProtocol(null)}
                  style={{ marginRight: '10px' }}
                >
                  Back to Protocols
                </Button>
                <Button 
                  onClick={async () => {
                    if (applicationId && applicationPath) {
                      const success = await checkAndInstallApplication(applicationId, applicationPath);
                      if (!success) {
                        return;
                      }
                    }

                    const result = await handleContextCreation(targetApplicationId);
                    if (result) {
                      onComplete(result.contextId, result.memberPublicKey);
                    }
                  }}
                  disabled={loading}
                  primary
                >
                  {loading ? 'Creating...' : 'Create Context'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>Please select a protocol:</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
                {PROTOCOLS.map((protocol) => (
                  <Button
                    key={protocol}
                    onClick={() => setSelectedProtocol(protocol)}
                    style={{ margin: '5px' }}
                    primary
                  >
                    {PROTOCOL_DISPLAY[protocol]}
                  </Button>
                ))}
              </div>
              <Button 
                onClick={() => {
                  setShowProtocolSelection(false);
                }}
                style={{ marginTop: '10px' }}
              >
                Back to Context List
              </Button>
            </>
          )}
        </EmptyState>
      )}

      {/* Context Selection */}
      {!selectedContext && !showProtocolSelection && (
        <>
          <SelectContext
            contextList={filteredContexts}
            setSelectedContextId={(id) => {
              handleContextSelect(id);
            }}
            backStep={onBack}
          />
          {/* Add Create Context Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <Button
              onClick={() => setShowProtocolSelection(true)}
              primary
            >
              + Create New Context
            </Button>
          </div>
        </>
      )}

      {/* Identity Selection */}
      {selectedContext && identities.length > 0 && !selectedIdentity && (
        <SelectContextIdentity
          contextIdentities={identities}
          selectedContextId={selectedContext}
          onSelectIdentity={handleIdentitySelect}
          backStep={() => {
            handleContextSelect(null);
          }}
        />
      )}

      {/* Permissions View */}
      {selectedContext && selectedIdentity && (
        <PermissionsView
          permissions={permissions}
          onComplete={(contextId, identity) => onComplete(contextId, identity)}
          onBack={() => handleIdentitySelect(null, '')}
          selectedContext={selectedContext}
          selectedIdentity={selectedIdentity}
        />
      )}
    </ContextSelectorWrapper>
  );
} 