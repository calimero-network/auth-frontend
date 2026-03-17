import { useEffect, useMemo, useState } from "react";
import { useContextSelection } from "../../hooks/useContextSelection";
import {
  PROTOCOL_DISPLAY,
  useContextCreation,
} from "../../hooks/useContextCreation";
import { getStoredUrlParam } from "../../utils/urlParams";
import { ErrorView } from "../common/ErrorView";
import { ContextSelectorWrapper } from "./styles";
import Loader from "../common/Loader";
import { PageShell } from "../common/PageShell";
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
} from "@calimero-network/mero-ui";

interface ContextSelectorProps {
  onComplete: (contextId: string, identity: string) => void;
  onBack: () => void;
}

const PRIMARY_BTN = {
  backgroundColor: '#A5FF11',
  color: '#0A0E13',
  border: 'none',
  fontWeight: 600,
} as const;

export function ContextSelector({ onComplete, onBack }: ContextSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  const applicationId = getStoredUrlParam("application-id");
  const applicationPath = getStoredUrlParam("application-path");
  const installedApplicationId =
    sessionStorage.getItem("installed-application-id") ||
    localStorage.getItem("installed-application-id");
  const targetApplicationId = applicationId || installedApplicationId;

  // Try to get a display name for the app from stored manifest info
  const appDisplayName = useMemo(() => {
    try {
      const stored = localStorage.getItem("manifest-info");
      if (stored) {
        const info = JSON.parse(stored);
        return info.name || null;
      }
    } catch {}
    return null;
  }, []);

  const [initArgs, setInitArgs] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const validateJson = (value: string) => {
    try {
      JSON.parse(value);
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError("Invalid JSON format");
      return false;
    }
  };

  const filteredContexts = useMemo(() => {
    if (!targetApplicationId) return contexts;
    return contexts.filter(
      (context) => context.applicationId === targetApplicationId,
    );
  }, [contexts, targetApplicationId]);

  const selectedContextDetails = useMemo(
    () => contexts.find((context) => context.id === selectedContext) ?? null,
    [contexts, selectedContext],
  );

  const formatPublicKey = (key: string) => {
    if (!key || key.length <= 16) return key;
    return `${key.slice(0, 10)}…${key.slice(-6)}`;
  };

  const loading = selectionLoading || creationLoading;
  const error = selectionError || creationError;

  useEffect(() => {
    if (selectedContext && selectedIdentity) {
      onComplete(selectedContext, selectedIdentity);
    }
  }, [selectedContext, selectedIdentity, onComplete]);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <PageShell>
        <ContextSelectorWrapper>
          <ErrorView message={error} onRetry={fetchContexts} />
        </ContextSelectorWrapper>
      </PageShell>
    );
  }

  // Application ID mismatch prompt
  if (showInstallPrompt) {
    return (
      <PageShell>
        <ContextSelectorWrapper>
          <Card variant="rounded" color="var(--color-border-brand)">
            <CardHeader>
              <CardTitle>Application ID mismatch</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack spacing="md" align="center">
                <Text align="center" color="muted">
                  The application ID in the request does not match the installed
                  application. Do you want to proceed with installation anyway?
                </Text>
                <Flex justify="center" gap="sm">
                  <Button variant="secondary" onClick={handleInstallCancel}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={loading}
                    onClick={async () => {
                      const contextData = await handleContextCreation(
                        applicationId || targetApplicationId,
                        initArgs,
                      );
                      if (contextData) {
                        handleContextSelect(contextData.contextId);
                        handleIdentitySelect(
                          contextData.contextId,
                          contextData.memberPublicKey,
                        );
                      }
                    }}
                    style={PRIMARY_BTN}
                  >
                    Install anyway
                  </Button>
                </Flex>
              </Stack>
            </CardContent>
          </Card>
        </ContextSelectorWrapper>
      </PageShell>
    );
  }

  // Create context form
  if (showCreateForm || (!filteredContexts.length && targetApplicationId && !selectedContext && !selectedIdentity)) {
    if (!selectedProtocol) {
      setSelectedProtocol("near");
    }

    return (
      <PageShell>
        <ContextSelectorWrapper>
          <Card variant="rounded" color="var(--color-border-brand)">
            <CardHeader>
              <Stack spacing="sm">
                <CardTitle>Create a new context</CardTitle>
                {appDisplayName && (
                  <Text size="sm" color="muted">
                    for{" "}
                    <span style={{ color: "#A5FF11", fontWeight: 600 }}>
                      {appDisplayName}
                    </span>
                  </Text>
                )}
              </Stack>
            </CardHeader>

            <CardContent>
              <Stack spacing="lg">
                {/* Protocol row */}
                <Flex align="center" justify="space-between">
                  <Text size="sm" color="muted">
                    Protocol
                  </Text>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 12px",
                      borderRadius: "999px",
                      background: "rgba(165, 255, 17, 0.1)",
                      border: "1px solid rgba(165, 255, 17, 0.3)",
                    }}
                  >
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#A5FF11",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#A5FF11",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {PROTOCOL_DISPLAY["near"]}
                    </span>
                  </div>
                </Flex>

                <Divider color="muted" spacing="sm" />

                {/* Init args */}
                <Stack spacing="sm">
                  <Flex align="center" justify="space-between">
                    <Text size="sm" weight="medium">
                      Initialization Arguments
                    </Text>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: "monospace",
                        background: "rgba(255,255,255,0.06)",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      JSON
                    </span>
                  </Flex>

                  <textarea
                    value={initArgs}
                    onChange={(e) => {
                      setInitArgs(e.target.value);
                      validateJson(e.target.value);
                    }}
                    placeholder='{"key": "value"}'
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: `1px solid ${
                        jsonError
                          ? "var(--color-semantic-error, #ef4444)"
                          : "rgba(255,255,255,0.1)"
                      }`,
                      background: "#0A0E13",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      resize: "vertical",
                      boxSizing: "border-box",
                      outline: "none",
                      transition: "border-color 0.15s ease",
                    }}
                    onFocus={(e) => {
                      if (!jsonError)
                        e.target.style.borderColor = "rgba(165, 255, 17, 0.5)";
                    }}
                    onBlur={(e) => {
                      if (!jsonError)
                        e.target.style.borderColor = "rgba(255,255,255,0.1)";
                    }}
                  />
                  {jsonError && (
                    <Text size="xs" color="error">
                      {jsonError}
                    </Text>
                  )}
                </Stack>

                <Flex justify="space-between" gap="sm">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCreateForm(false);
                      setSelectedProtocol(null);
                    }}
                    style={{ flex: 1 }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    disabled={creationLoading || !!jsonError}
                    onClick={async () => {
                      if (!validateJson(initArgs)) return;
                      if (applicationId && applicationPath) {
                        const success = await checkAndInstallApplication(
                          applicationId,
                          applicationPath,
                        );
                        if (!success) return;
                      }
                      const result = await handleContextCreation(
                        targetApplicationId,
                        initArgs,
                      );
                      if (result) {
                        onComplete(result.contextId, result.memberPublicKey);
                      }
                    }}
                    style={{ flex: 1, ...PRIMARY_BTN }}
                  >
                    {creationLoading ? (
                      <Flex align="center" gap="xs" justify="center">
                        <span
                          style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            border: "2px solid currentColor",
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                            animation: "spin 0.7s linear infinite",
                          }}
                        />
                        Creating…
                      </Flex>
                    ) : (
                      "Create context"
                    )}
                  </Button>
                </Flex>
              </Stack>
            </CardContent>
          </Card>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </ContextSelectorWrapper>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ContextSelectorWrapper>
        {/* Context selection */}
        {!selectedContext && (
          <Card variant="rounded" color="var(--color-border-brand)">
            <CardHeader>
              <Stack spacing="sm">
                <CardTitle>Select a context</CardTitle>
                {appDisplayName && (
                  <Text size="sm" color="muted">
                    for{" "}
                    <span style={{ color: "#A5FF11", fontWeight: 600 }}>
                      {appDisplayName}
                    </span>
                  </Text>
                )}
              </Stack>
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
                        <Stack spacing="sm">
                          <Text weight="medium">
                            {(context as any).name || context.id}
                          </Text>
                          <Text size="xs" color="muted">
                            {context.id}
                          </Text>
                          {(context as any).protocol && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#A5FF11",
                                background: "rgba(165,255,17,0.08)",
                                border: "1px solid rgba(165,255,17,0.2)",
                                padding: "1px 7px",
                                borderRadius: "999px",
                                width: "fit-content",
                              }}
                            >
                              {PROTOCOL_DISPLAY[(context as any).protocol as keyof typeof PROTOCOL_DISPLAY] ?? (context as any).protocol}
                            </span>
                          )}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Menu>
                  <Divider color="muted" spacing="sm" />
                  <Flex justify="space-between" gap="sm">
                    <Button
                      variant="secondary"
                      onClick={onBack}
                      style={{ flex: 1 }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedProtocol("near");
                        setShowCreateForm(true);
                      }}
                      style={{ flex: 1, ...PRIMARY_BTN }}
                    >
                      + New context
                    </Button>
                  </Flex>
                </Stack>
              ) : (
                <EmptyState
                  title="No contexts found"
                  description="Create a context to link this application to your node."
                  action={
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedProtocol("near");
                        setShowCreateForm(true);
                      }}
                      style={PRIMARY_BTN}
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
        {selectedContext &&
          !selectedIdentity &&
          (identities.length > 0 ? (
            <Card variant="rounded" color="var(--color-border-brand)">
              <CardHeader>
                <CardTitle>Select an identity</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack spacing="lg">
                  {selectedContextDetails && (
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#0A0E13",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "8px",
                      }}
                    >
                      <Text size="xs" color="muted" style={{ marginBottom: "2px", display: "block" }}>
                        Context
                      </Text>
                      <Text size="sm" weight="medium">
                        {(selectedContextDetails as any).name || selectedContextDetails.id}
                      </Text>
                    </div>
                  )}

                  <Menu variant="compact" size="md">
                    {identities.map((identity) => (
                      <MenuItem
                        key={identity}
                        selected={selectedIdentity === identity}
                        onClick={() =>
                          handleIdentitySelect(selectedContext, identity)
                        }
                      >
                        <Stack spacing="sm">
                          <Text weight="medium">{formatPublicKey(identity)}</Text>
                          <Text size="xs" color="muted">
                            {identity}
                          </Text>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Menu>

                  <Button
                    variant="secondary"
                    onClick={() => handleContextSelect(null)}
                  >
                    Back to contexts
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Card variant="rounded" color="var(--color-border-brand)">
              <CardHeader>
                <CardTitle>No identities found</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="This context has no identities yet"
                  description="Create an identity for this context in the node dashboard and try again."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => handleContextSelect(null)}
                    >
                      Back to contexts
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ))}
      </ContextSelectorWrapper>
    </PageShell>
  );
}
