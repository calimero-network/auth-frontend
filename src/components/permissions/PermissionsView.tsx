import React, { useEffect, useState } from 'react';
import { getStoredUrlParam } from '../../utils/urlParams';
import { tokens } from '@calimero-network/mero-tokens';

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
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '32px 24px',
      fontFamily: tokens.font.body.value,
      backgroundColor: tokens.color.background.primary.value,
      minHeight: '100vh'
    }}>
      {/* Package Info Banner - Brand colored */}
      {manifestData && (
        <div style={{
          backgroundColor: tokens.color.background.brand.value,
          border: `1px solid ${tokens.color.brand['700'].value}`,
          borderRadius: tokens.radius.md.value,
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>📦</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: tokens.color.brand['100'].value }}>
                {manifestData.name}
              </div>
              <div style={{ fontSize: '14px', color: tokens.color.neutral['300'].value, marginTop: '4px' }}>
                Package: {manifestData.id}@{manifestData.version}
              </div>
              {referrer && (
                <div style={{ fontSize: '12px', color: tokens.color.neutral['400'].value, marginTop: '4px' }}>
                  Requested by: {referrer}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Title */}
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: '700', 
        color: tokens.color.neutral['200'].value,
        marginBottom: '8px'
      }}>
        Review Permissions
      </h2>
      
      <p style={{ 
        fontSize: '14px', 
        color: tokens.color.neutral['300'].value,
        marginBottom: '24px'
      }}>
        This application is requesting the following permissions:
      </p>
      
      {/* Permission Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
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
                border: `1px solid ${tokens.color.neutral['600'].value}`,
                borderRadius: tokens.radius.md.value,
                padding: '16px',
                backgroundColor: tokens.color.background.secondary.value,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* Risk Badge - Semantic colors */}
                <div style={{
                  backgroundColor: RISK_COLORS[info.risk] + '20',
                  color: RISK_COLORS[info.risk],
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}>
                  {info.risk} risk
                </div>
                
                {/* Icon */}
                <div style={{ fontSize: '24px', flexShrink: 0 }}>
                  {info.icon}
                </div>
                
                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: tokens.color.neutral['200'].value, marginBottom: '4px' }}>
                    {info.title}
                  </div>
                  <div style={{ fontSize: '14px', color: tokens.color.neutral['300'].value }}>
                    {info.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Security Warning */}
      <div style={{
        backgroundColor: tokens.color.semantic.warning.value + '20',
        border: `1px solid ${tokens.color.semantic.warning.value}`,
        borderRadius: tokens.radius.sm.value,
        padding: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: tokens.color.neutral['200'].value, marginBottom: '4px' }}>
              Security Notice
            </div>
            <div style={{ fontSize: '13px', color: tokens.color.neutral['300'].value }}>
              Only approve permissions for applications you trust. These permissions grant access to your node and data.
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '500',
            color: tokens.color.neutral['300'].value,
            backgroundColor: tokens.color.background.secondary.value,
            border: `1px solid ${tokens.color.neutral['600'].value}`,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = tokens.color.background.tertiary.value}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = tokens.color.background.secondary.value}
        >
          Deny
        </button>
        
        <button
          onClick={() => onComplete(selectedContext, selectedIdentity)}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '500',
            color: tokens.color.neutral['900'].value,
            backgroundColor: tokens.color.brand['600'].value,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = tokens.color.brand['700'].value}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = tokens.color.brand['600'].value}
        >
          Approve Permissions
        </button>
      </div>
    </div>
  );
}
