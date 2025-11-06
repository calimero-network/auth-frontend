import React, { useEffect, useState } from 'react';
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

interface PermissionsViewProps {
  permissions: string[];
  selectedContext: string;
  selectedIdentity: string;
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
  onComplete,
  onBack
}: PermissionsViewProps) {
  const [manifestData, setManifestData] = useState<any>(null);
  const [referrer, setReferrer] = useState<string>('');
  const manifestUrl = getStoredUrlParam('manifest-url');
  const hasAdminPermission = permissions.includes('admin');
  
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
  
  console.log('PermissionsView props:', { selectedContext, selectedIdentity, manifestUrl, referrer });
  
  return (
    <div style={{ 
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 600,
      width: '100%',
      padding: '0 16px',
    }}>
      <Card variant="rounded" color="var(--color-border-brand)">
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
              This application is requesting the following permissions:
            </Text>
      
            {/* Permission Cards */}
            <Stack spacing="sm">
              {permissions.map((permission) => {
                const info = PERMISSION_DETAILS[permission] || {
                  title: permission,
                  description: 'Permission access',
                  risk: 'medium' as const,
                  icon: '🔒'
                };
                
                return (
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
              })}
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
                Deny
              </Button>
              
              <Button
                variant="primary"
                onClick={() => onComplete(selectedContext, selectedIdentity)}
                style={{
                  color: 'var(--color-text-brand)',
                  borderColor: 'var(--color-border-brand)',
                }}
              >
                Approve Permissions
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
    </div>
  );
}
