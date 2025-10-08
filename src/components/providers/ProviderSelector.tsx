import React from 'react';
import { Provider } from '@calimero-network/calimero-client/lib/api/authApi';
import Button from '../common/Button';
import {
  ProviderContainer,
  ProviderTitle,
  ProviderGrid,
  ProviderCard,
  ProviderIcon,
  ProviderName,
  ProviderDescription,
  LoadingSpinner,
  NoProvidersMessage,
  ButtonContainer
} from './styles';

interface ProviderSelectorProps {
  providers: Provider[];
  onProviderSelect: (provider: Provider) => void;
  loading: boolean;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ 
  providers, 
  onProviderSelect,
  loading
}) => {


  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (providers.length === 0) {
    return (
      <NoProvidersMessage>
        No authentication providers are available.
      </NoProvidersMessage>
    );
  }
  
  return (
    <ProviderContainer>
      <ProviderTitle>Choose an authentication method</ProviderTitle>
      <ProviderGrid>
        {providers.map((provider) => (
          <ProviderCard
            key={provider.name}
            onClick={() => onProviderSelect(provider)}
          >
            <ProviderName>{provider.name}</ProviderName>
            <ProviderDescription>
              {provider.description}
            </ProviderDescription>
          </ProviderCard>
        ))}
      </ProviderGrid>
    </ProviderContainer>
  );
};

export default ProviderSelector; 