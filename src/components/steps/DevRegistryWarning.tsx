import React from 'react';
import styled from 'styled-components';

const WarningBanner = styled.div`
  background-color: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  align-items: start;
  gap: 12px;
`;

const WarningIcon = styled.div`
  font-size: 24px;
  flex-shrink: 0;
`;

const WarningContent = styled.div`
  flex: 1;
`;

const WarningTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #856404;
  margin-bottom: 4px;
`;

const WarningText = styled.div`
  font-size: 14px;
  color: #856404;
  line-height: 1.5;
`;

const RegistryUrl = styled.code`
  background-color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #d97706;
  word-break: break-all;
`;

interface DevRegistryWarningProps {
  registryUrl: string;
}

/**
 * DevRegistryWarning - Displays a warning banner when using non-production registry
 * 
 * Shows when registryUrl is provided and is NOT the production Vercel registry.
 * This helps users understand they're installing apps from a development/testing registry.
 */
export const DevRegistryWarning: React.FC<DevRegistryWarningProps> = ({ registryUrl }) => {
  const PRODUCTION_REGISTRY = 'https://mero-registry.vercel.app/api';
  
  if (registryUrl === PRODUCTION_REGISTRY) {
    return null;
  }
  
  return (
    <WarningBanner>
      <WarningIcon>⚠️</WarningIcon>
      <WarningContent>
        <WarningTitle>Development Registry</WarningTitle>
        <WarningText>
          This application is being installed from a development registry:
          <br />
          <RegistryUrl>{registryUrl}</RegistryUrl>
          <br />
          <br />
          This is NOT the official Calimero registry. Only proceed if you trust this source.
        </WarningText>
      </WarningContent>
    </WarningBanner>
  );
};




