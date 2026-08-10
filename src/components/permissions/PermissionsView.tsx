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
  icon: string;
}

const PERMISSION_DETAILS: Record<string, PermissionInfo> = {
  'context:create': {
    title: 'Create Contexts',
    description: 'Create new private contexts (e.g., vaults, workspaces)',
    risk: 'low',
    icon: '➕'
  },
  'context:list': {
    title: 'List Contexts',
    description: 'View your existing contexts',
    risk: 'low',
    icon: '📋'
  },
  'context:execute': {
    title: 'Execute Smart Contracts',
    description: 'Run application code in your private contexts',
    risk: 'medium',
    icon: '⚡'
  },
  'context:alias': {
    title: 'Name Contexts',
    description: 'Give your contexts readable names, and look them up by name',
    risk: 'low',
    icon: '🏷️'
  },
  'namespace': {
    title: 'Namespaces',
    description: 'View, create, and manage the shared spaces this app works in',
    risk: 'medium',
    icon: '🗂️'
  },
  'group': {
    title: 'Groups & Members',
    description: 'Create groups inside a namespace and manage who belongs to them',
    risk: 'medium',
    icon: '👥'
  },
  'blob': {
    title: 'Files',
    description: 'Upload and download files this app stores on your node',
    risk: 'low',
    icon: '📎'
  },
  'application:list': {
    title: 'List Applications',
    description: 'See which applications are installed on your node',
    risk: 'low',
    icon: '🔍'
  },
  'application': {
    title: 'Application Management',
    description: 'Install, uninstall, and manage applications (admin only)',
    risk: 'medium',
    icon: '📦'
  },
  'admin': {
    title: 'Full Node Administration',
    description: 'Complete control over node configuration and all data',
    risk: 'high',
    icon: '🔐'
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
      icon: '🔒'
    }
  );
}

/**
 * Below this many non-critical permissions the list is short enough to show
 * outright; at or above it the detail collapses behind a summary row.
 */
const COLLAPSE_THRESHOLD = 3;

// Use design system semantic colors
const RISK_COLORS = {
  low: tokens.color.semantic.success.value,
  medium: tokens.color.semantic.warning.value,
  high: tokens.color.semantic.error.value
};

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
  const hasAdminPermission = normalizedPermissions.includes('admin');
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
  
  const renderPermissionCard = ({ permission, info }: { permission: string; info: PermissionInfo }) => (
    <div
      key={permission}
      style={{
        border: `1px solid ${tokens.color.neutral['700'].value}`,
        borderRadius: tokens.radius.md.value,
        padding: '12px 16px',
        backgroundColor: tokens.color.background.secondary.value,
      }}
    >
      <Flex align="flex-start" gap="sm">
        {/* Risk Badge */}
        <div style={{
          backgroundColor: RISK_COLORS[info.risk] + '20',
          color: RISK_COLORS[info.risk],
          fontSize: '10px',
          fontWeight: '700',
          padding: '4px 8px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          flexShrink: 0,
          lineHeight: 1,
        }}>
          {info.risk} risk
        </div>

        {/* Icon */}
        <span style={{ fontSize: '20px', flexShrink: 0 }}>
          {info.icon}
        </span>

        {/* Info */}
        <Stack spacing="xs" style={{ flex: 1 }}>
          <Text weight="semibold" size="sm">
            {info.title}
          </Text>
          <Text size="xs" color="muted">
            {info.description}
          </Text>
        </Stack>
      </Flex>
    </div>
  );

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
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>🔒</span>
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

            {/* Critical Warning for Admin Permissions */}
            {hasAdminPermission && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${tokens.color.semantic.error.value}`,
                background: `${tokens.color.semantic.error.value}18`,
                color: 'var(--color-text-primary)',
              }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>🛑</span>
                <Stack spacing="xs">
                  <Text weight="bold" size="sm" style={{ 
                    color: tokens.color.semantic.error.value,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Admin Access Requested
                  </Text>
                  <Text size="xs">
                    Granting <strong style={{ color: tokens.color.semantic.error.value }}>admin</strong> permission gives this application unrestricted control over your node. Only approve this if you fully trust the application and understand the risks.
                  </Text>
                </Stack>
              </div>
            )}
            
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
