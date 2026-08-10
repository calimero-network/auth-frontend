import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../common/PageShell';
import { getStoredUrlParam } from '../../utils/urlParams';
import { tokens } from '@calimero-network/mero-tokens';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Divider,
  Flex,
  Stack,
  Text,
} from '@calimero-network/mero-ui';
import { normalizePermissions } from '../../utils/permissions';
import { AppMode } from '../../types/flows';

interface PermissionsViewProps {
  permissions: string[];
  selectedContext: string;
  selectedIdentity: string;
  mode?: AppMode | string | null;
  onComplete: (context: string, identity: string) => void;
  onBack: () => void;
}

interface PermissionInfo {
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  /**
   * Why the grant is high risk, in the user's terms. Only high-risk entries
   * carry a badge, so this is the copy that has to justify it.
   */
  whyHighRisk?: string;
}

const PERMISSION_DETAILS: Record<string, PermissionInfo> = {
  'context:create': {
    title: 'Create Contexts',
    description: 'Create new private contexts (e.g., vaults, workspaces)',
    risk: 'low',
  },
  'context:list': {
    title: 'List Contexts',
    description: 'View your existing contexts',
    risk: 'low',
  },
  'context:execute': {
    title: 'Run WASM Applications',
    description: 'Execute this application’s WASM code inside your private contexts',
    risk: 'medium',
  },
  'context:alias': {
    title: 'Name Contexts',
    description: 'Give your contexts readable names, and look them up by name',
    risk: 'low',
  },
  'namespace': {
    title: 'Namespaces',
    description: 'View, create, and manage the shared spaces this app works in',
    risk: 'medium',
  },
  'group': {
    title: 'Groups & Members',
    description: 'Create groups inside a namespace and manage who belongs to them',
    risk: 'medium',
  },
  'blob': {
    title: 'Files',
    description: 'Upload and download files this app stores on your node',
    risk: 'low',
  },
  'application:list': {
    title: 'List Applications',
    description: 'See which applications are installed on your node',
    risk: 'low',
  },
  'application': {
    title: 'Application Management',
    description: 'Install, uninstall, and manage applications (admin only)',
    risk: 'medium',
  },
  'admin': {
    title: 'Full Node Administration',
    description: 'Complete control over node configuration and all data',
    risk: 'high',
    whyHighRisk:
      'Unlike the other permissions, this one is not limited to what this application does. It covers the whole node: every context and file you hold, the applications you have installed, and your keys — including the ability to issue new access to itself or to someone else. It cannot be narrowed down, and the only way to take it back is to revoke the key.',
  }
};

/**
 * Scope strings are not always a bare key: core accepts bracket params
 * (`namespace:list[ns-1]`) and family-wide grants (`namespace` covers every
 * `namespace:*`). Resolve the most specific copy we have, then fall back to
 * the family, then to the raw string — so an unknown scope still renders as a
 * card instead of leaking a bare `group:create` at the user.
 */
function describePermission(permission: string): PermissionInfo {
  const base = permission.split('[')[0].trim();
  const family = base.split(':')[0];

  return (
    PERMISSION_DETAILS[base] ||
    PERMISSION_DETAILS[family] || {
      title: base,
      description: 'Additional access requested by this application',
      risk: 'medium' as const,
    }
  );
}

/**
 * Below this many non-critical permissions the list is short enough to show
 * outright; at or above it the detail collapses behind a summary row.
 */
const COLLAPSE_THRESHOLD = 3;

// Only high risk is called out. A badge on every card made "low risk" and
// "medium risk" the loudest thing on the screen and left nothing for the one
// grant that actually needs to stand out.
const HIGH_RISK_COLOR = tokens.color.semantic.error.value;

export function PermissionsView({
  permissions,
  selectedContext,
  selectedIdentity,
  mode: modeProp,
  onComplete,
  onBack
}: PermissionsViewProps) {
  const [manifestData, setManifestData] = useState<any>(null);
  const [referrer, setReferrer] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const storedMode = getStoredUrlParam('mode');
  const normalizedMode = useMemo(() => {
    const candidate = modeProp ?? storedMode ?? '';
    return (typeof candidate === 'string' ? candidate.toLowerCase() : candidate) as AppMode;
  }, [modeProp, storedMode]);
  const normalizedPermissions = useMemo(
    () => normalizePermissions(normalizedMode, permissions),
    [normalizedMode, permissions],
  );
  const primaryLabel = normalizedMode === 'admin' ? 'Generate Token' : 'Approve Permissions';
  const secondaryLabel = normalizedMode === 'admin' ? 'Cancel' : 'Deny';

  const described = useMemo(
    () =>
      normalizedPermissions.map((permission) => ({
        permission,
        info: describePermission(permission),
      })),
    [normalizedPermissions],
  );

  // High-risk grants are never collapsed — hiding them behind a toggle would
  // hide exactly what the user has to see before approving.
  const critical = described.filter(({ info }) => info.risk === 'high');
  const routine = described.filter(({ info }) => info.risk !== 'high');
  const isCollapsible = routine.length >= COLLAPSE_THRESHOLD;
  const routineVisible = !isCollapsible || showDetails;

  const summaryPreview = useMemo(() => {
    const titles = routine.slice(0, 3).map(({ info }) => info.title);
    const hidden = routine.length - titles.length;
    return hidden > 0 ? `${titles.join(', ')} +${hidden} more` : titles.join(', ');
  }, [routine]);

  useEffect(() => {
    // Load manifest data if available
    const stored = localStorage.getItem('manifest-data');
    if (stored) {
      try {
        setManifestData(JSON.parse(stored));
      } catch (err) {
        console.warn('Could not parse manifest data:', err);
      }
    }
    
    // Get referrer from callback URL
    const callbackUrl = getStoredUrlParam('callback-url');
    if (callbackUrl) {
      try {
        const url = new URL(callbackUrl);
        setReferrer(url.origin);
      } catch (err) {
        console.warn('Could not parse callback URL:', err);
      }
    }
  }, []);
  
  const renderPermissionCard = ({ permission, info }: { permission: string; info: PermissionInfo }) => {
    const isHighRisk = info.risk === 'high';

    return (
      <div
        key={permission}
        style={{
          border: `1px solid ${isHighRisk ? HIGH_RISK_COLOR : tokens.color.neutral['700'].value}`,
          borderRadius: tokens.radius.md.value,
          padding: '12px 16px',
          backgroundColor: isHighRisk
            ? `${HIGH_RISK_COLOR}12`
            : tokens.color.background.secondary.value,
        }}
      >
        <Stack spacing="xs">
          <Flex align="center" gap="sm" wrap="wrap">
            <Text weight="semibold" size="sm">
              {info.title}
            </Text>
            {isHighRisk && (
              <span style={{
                backgroundColor: `${HIGH_RISK_COLOR}20`,
                color: HIGH_RISK_COLOR,
                fontSize: '10px',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
                flexShrink: 0,
              }}>
                High risk
              </span>
            )}
          </Flex>

          <Text size="xs" color="muted">
            {info.description}
          </Text>

          {isHighRisk && (
            <div style={{
              marginTop: '4px',
              paddingTop: '8px',
              borderTop: `1px solid ${HIGH_RISK_COLOR}33`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              {info.whyHighRisk && (
                <Text size="xs" color="muted">
                  <strong style={{ color: HIGH_RISK_COLOR }}>Why this is high risk:</strong>{' '}
                  {info.whyHighRisk}
                </Text>
              )}
              <Text size="xs">
                Only approve this if you fully trust the application and understand what it can do.
              </Text>
            </div>
          )}
        </Stack>
      </div>
    );
  };

  return (
    <PageShell>
      <Card
        variant="rounded"
        color="var(--color-border-brand)"
        style={{ width: '100%' }}
      >
        <CardHeader>
          <CardTitle>Review Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack spacing="lg">
            {/* Package Info - Brand colored banner */}
            {manifestData && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${tokens.color.brand['600'].value}`,
                background: `${tokens.color.brand['600'].value}14`,
                color: 'var(--color-text-primary)',
              }}>
                <span style={{ fontSize: '24px', flexShrink: 0 }}>📦</span>
                <Stack spacing="xs">
                  <Text weight="semibold" size="md">
                    {manifestData.name}
                  </Text>
                  <Text size="sm" color="muted">
                    Package: {manifestData.id}@{manifestData.version}
                  </Text>
                  {referrer && (
                    <Text size="xs" color="muted">
                      Requested by: {referrer}
                    </Text>
                  )}
                </Stack>
              </div>
            )}
            
            <Text color="muted">
              {described.length === 1
                ? 'This application is requesting one permission.'
                : `This application is requesting ${described.length} permissions.`}
            </Text>

            {/* Permission Cards — critical grants always visible, the routine
                ones summarised behind a disclosure so the popup stays short. */}
            <Stack spacing="sm">
              {critical.map(renderPermissionCard)}

              {isCollapsible && (
                <button
                  type="button"
                  onClick={() => setShowDetails((open) => !open)}
                  aria-expanded={showDetails}
                  aria-controls="permission-details"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: 'pointer',
                    border: `1px solid ${tokens.color.neutral['700'].value}`,
                    borderRadius: tokens.radius.md.value,
                    padding: '12px 16px',
                    backgroundColor: tokens.color.background.secondary.value,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    <Text as="span" weight="semibold" size="sm">
                      {routine.length === 1
                        ? '1 more permission'
                        : `${routine.length} standard permissions`}
                    </Text>
                    <Text as="span" size="xs" color="muted">
                      {summaryPreview}
                    </Text>
                  </span>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                  }}>
                    <Text as="span" size="xs" color="muted">
                      {showDetails ? 'Hide' : 'Details'}
                    </Text>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      style={{
                        transform: showDetails ? 'rotate(180deg)' : 'none',
                        transition: 'transform 120ms ease',
                      }}
                    >
                      <path
                        d="M2 4.5 6 8.5 10 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              )}

              {/* `display: contents` keeps the always-present aria-controls
                  target from adding a stray gap while collapsed. */}
              <div id="permission-details" style={{ display: 'contents' }}>
                {routineVisible && (
                  <Stack spacing="sm">{routine.map(renderPermissionCard)}</Stack>
                )}
              </div>
            </Stack>

            {/* Security Warning */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${tokens.color.semantic.warning.value}`,
              background: `${tokens.color.semantic.warning.value}14`,
              color: 'var(--color-text-primary)',
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
              <Stack spacing="xs">
                <Text weight="semibold" size="sm">
                  Security Notice
                </Text>
                <Text size="xs">
                  Only approve permissions for applications you trust. These permissions grant access to your node and data.
                </Text>
              </Stack>
            </div>
            
            {/* Action Buttons */}
            <Flex justify="flex-end" gap="sm">
              <Button
                variant="secondary"
                onClick={onBack}
              >
                {secondaryLabel}
              </Button>
              
              <Button
                variant="primary"
                onClick={() => onComplete(selectedContext, selectedIdentity)}
                style={{
                  backgroundColor: '#A5FF11',
                  color: '#0A0E13',
                  border: 'none',
                }}
              >
                {primaryLabel}
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </PageShell>
  );
}
