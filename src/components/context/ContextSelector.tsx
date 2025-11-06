import { useEffect, useMemo, useState } from 'react';
import { useContextSelection } from '../../hooks/useContextSelection';
import { PROTOCOLS, PROTOCOL_DISPLAY, useContextCreation } from '../../hooks/useContextCreation';
import { getStoredUrlParam } from '../../utils/urlParams';
import { ErrorView } from '../common/ErrorView';
import { PermissionsView } from '../permissions/PermissionsView';
import {
  ContextSelectorWrapper,
} from './styles';
import Loader from '../common/Loader';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  EmptyState,
  Flex,
  Menu,
  MenuItem,
  Stack,
  Text,
} from '@calimero-network/mero-ui';

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

  const selectedContextDetails = useMemo(
    () => contexts.find((context) => context.id === selectedContext) ?? null,
    [contexts, selectedContext],
  );

  const formatPublicKey = (key: string) => {
    if (!key) {
      return '';
    }
    if (key.length <= 16) {
      return key;
    }
    return `${key.slice(0, 10)}…${key.slice(-6)}`;
  };

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
        <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 520 }}>
          <CardHeader>
            <CardTitle>Application ID mismatch</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack spacing="md" align="center">
              <Text align="center" color="muted">
                The application ID in the request does not match the installed application. Do you want to proceed with installation anyway?
              </Text>
              <Flex justify="center" gap="sm">
                <Button variant="secondary" onClick={handleInstallCancel}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={loading}
                  onClick={async () => {
                    const contextData = await handleContextCreation(applicationId || targetApplicationId);
                    if (contextData) {
                      handleContextSelect(contextData.contextId);
                      handleIdentitySelect(contextData.contextId, contextData.memberPublicKey);
                    }
                  }}
                  style={{
                    color: 'var(--color-text-brand)',
                    borderColor: 'var(--color-border-brand)',
                  }}
                >
                  Install anyway
                </Button>
              </Flex>
            </Stack>
          </CardContent>
        </Card>
      </ContextSelectorWrapper>
    );
  }

  // No contexts available and applicationPath is present - show create context prompt
  if (!filteredContexts.length && targetApplicationId && !selectedContext && !selectedIdentity) {
    return (
      <ContextSelectorWrapper>
        <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 520 }}>
          <CardHeader>
            <CardTitle>Create a new context</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack spacing="lg" align="center">
              <Text align="center" color="muted">
                There are no contexts available for this application yet. Create one to continue.
              </Text>

              {!showProtocolSelection && (
                <Button
                  variant="primary"
                  onClick={() => setShowProtocolSelection(true)}
                  style={{
                    color: 'var(--color-text-brand)',
                    borderColor: 'var(--color-border-brand)',
                  }}
                >
                  Create new context
                </Button>
              )}

              {showProtocolSelection && !selectedProtocol && (
                <Stack spacing="md" align="center" style={{ width: '100%' }}>
                  <Text color="secondary">Select a protocol for the new context</Text>
                  <Flex wrap="wrap" justify="center" gap="sm" style={{ width: '100%' }}>
                    {PROTOCOLS.map((protocol) => (
                      <Button
                        key={protocol}
                        variant="secondary"
                        onClick={() => setSelectedProtocol(protocol)}
                      >
                        {PROTOCOL_DISPLAY[protocol]}
                      </Button>
                    ))}
                  </Flex>
                  <Button variant="secondary" onClick={() => setShowProtocolSelection(false)}>
                    Back
                  </Button>
                </Stack>
              )}

              {showProtocolSelection && selectedProtocol && (
                <Stack spacing="md" align="center">
                  <Text size="sm" color="secondary">
                    Selected protocol: {PROTOCOL_DISPLAY[selectedProtocol]}
                  </Text>
                  <Flex justify="center" gap="sm">
                    <Button variant="secondary" onClick={() => setSelectedProtocol(null)}>
                      Change protocol
                    </Button>
                    <Button
                      variant="primary"
                      disabled={loading}
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
                      style={{
                        color: 'var(--color-text-brand)',
                        borderColor: 'var(--color-border-brand)',
                      }}
                    >
                      {loading ? 'Creating…' : 'Create context'}
                    </Button>
                  </Flex>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </ContextSelectorWrapper>
    );
  }

  return (
    <ContextSelectorWrapper>
      {/* Create new context flow when contexts already exist */}
      {showProtocolSelection && !selectedContext && filteredContexts.length > 0 && (
        <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 520 }}>
          <CardHeader>
            <CardTitle>Create a new context</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack spacing="lg" align="center">
              {!selectedProtocol ? (
                <>
                  <Text align="center" color="muted">
                    Choose a protocol to create a fresh context for this application.
                  </Text>
                  <Flex wrap="wrap" justify="center" gap="sm" style={{ width: '100%' }}>
                    {PROTOCOLS.map((protocol) => (
                      <Button
                        key={protocol}
                        variant="secondary"
                        onClick={() => setSelectedProtocol(protocol)}
                      >
                        {PROTOCOL_DISPLAY[protocol]}
                      </Button>
                    ))}
                  </Flex>
                  <Button variant="secondary" onClick={() => setShowProtocolSelection(false)}>
                    Back to contexts
                  </Button>
                </>
              ) : (
                <>
                  <Text size="sm" color="secondary">
                    Selected protocol: {PROTOCOL_DISPLAY[selectedProtocol]}
                  </Text>
                  <Flex justify="center" gap="sm">
                    <Button variant="secondary" onClick={() => setSelectedProtocol(null)}>
                      Change protocol
                    </Button>
                    <Button
                      variant="primary"
                      disabled={loading}
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
                      style={{
                        color: 'var(--color-text-brand)',
                        borderColor: 'var(--color-border-brand)',
                      }}
                    >
                      {loading ? 'Creating…' : 'Create context'}
                    </Button>
                  </Flex>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Context selection */}
      {!selectedContext && !showProtocolSelection && (
        <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 520 }}>
          <CardHeader>
            <CardTitle>Select a context</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredContexts.length > 0 ? (
              <Stack spacing="lg">
                <Menu variant="compact" size="md">
                  {filteredContexts.map((context) => (
                    <MenuItem
                      key={context.id}
                      selected={selectedContext === context.id}
                      onClick={() => handleContextSelect(context.id)}
                    >
                      <Stack spacing="xs">
                        <Text weight="medium">{(context as any).name || context.id}</Text>
                        <Text size="xs" color="muted">
                          ID: {context.id}
                        </Text>
                        {(context as any).protocol && (
                          <Text size="xs" color="secondary">
                            Protocol: {PROTOCOL_DISPLAY[(context as any).protocol as keyof typeof PROTOCOL_DISPLAY] ?? (context as any).protocol}
                          </Text>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </Menu>
                <Divider color="muted" spacing="sm" />
                <Stack spacing="sm" align="center">
                  <Text size="sm" color="muted" align="center">
                    Need a fresh workspace? Create a new context for better privacy and isolation.
                  </Text>
                  <Flex justify="space-between" gap="sm" style={{ width: '100%' }}>
                    <Button variant="secondary" onClick={onBack} style={{ flex: 1 }}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedProtocol(null);
                        setShowProtocolSelection(true);
                      }}
                      style={{
                        flex: 1,
                        color: 'var(--color-text-brand)',
                        borderColor: 'var(--color-border-brand)',
                      }}
                    >
                      + Create new context
                    </Button>
                  </Flex>
                </Stack>
              </Stack>
            ) : (
              <EmptyState
                title="No contexts found"
                description="Create a context to link this application to your node."
                action={
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedProtocol(null);
                      setShowProtocolSelection(true);
                    }}
                    style={{
                      color: 'var(--color-text-brand)',
                      borderColor: 'var(--color-border-brand)',
                    }}
                  >
                    Create new context
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Identity selection */}
      {selectedContext && !selectedIdentity && (
        identities.length > 0 ? (
          <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 520 }}>
            <CardHeader>
              <CardTitle>Select an identity</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack spacing="lg">
                {selectedContextDetails && (
                  <Stack spacing="xs">
                    <Text size="sm" color="secondary">
                      Context: {(selectedContextDetails as any).name || selectedContextDetails.id}
                    </Text>
                    <Text size="xs" color="muted">ID: {selectedContextDetails.id}</Text>
                  </Stack>
                )}

                <Menu variant="compact" size="md">
                  {identities.map((identity) => (
                    <MenuItem
                      key={identity}
                      selected={selectedIdentity === identity}
                      onClick={() => handleIdentitySelect(selectedContext, identity)}
                    >
                      <Stack spacing="xs">
                        <Text weight="medium">{formatPublicKey(identity)}</Text>
                        <Text size="xs" color="muted">
                          {identity}
                        </Text>
                      </Stack>
                    </MenuItem>
                  ))}
                </Menu>

                <Button variant="secondary" onClick={() => handleContextSelect(null)}>
                  Back to contexts
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Card variant="rounded" color="var(--color-border-brand)" style={{ maxWidth: 520 }}>
            <CardHeader>
              <CardTitle>No identities found</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="This context has no identities yet"
                description="Create an identity for this context in the node dashboard and try again."
                action={
                  <Button variant="secondary" onClick={() => handleContextSelect(null)}>
                    Back to contexts
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )
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