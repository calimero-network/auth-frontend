import React from 'react';
interface Provider { name: string; type: string; description?: string; configured?: boolean; config?: Record<string, unknown>; [key: string]: unknown; }
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Loader,
  Menu,
  MenuItem,
  Stack,
  Text,
} from '@calimero-network/mero-ui';
import { PageShell } from '../common/PageShell';

interface ProviderSelectorProps {
  providers: Provider[];
  onProviderSelect: (provider: Provider) => void;
  loading: boolean;
  error?: string | null;
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'near_wallet': 'NEAR Wallet',
  'user_password': 'Username/Password',
  'username_password': 'Username/Password',
};

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  onProviderSelect,
  loading,
  error,
}) => {
  if (loading) {
    return <Loader />;
  }

  if (providers.length === 0) {
    return (
      <PageShell>
        <Card variant="rounded" color="var(--color-border-brand)">
          <CardContent>
            <EmptyState
              title="No providers available"
              description="No authentication providers are configured on this node."
              variant="minimal"
            />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card variant="rounded" color="var(--color-border-brand)">
        <CardHeader>
          <CardTitle>Choose an authentication method</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Stack spacing="sm" align="center" style={{ marginBottom: '12px' }}>
              <Text color="error">{error}</Text>
            </Stack>
          )}
          <Menu variant="compact" size="md">
            {providers.map((provider) => (
              <MenuItem
                key={provider.name}
                onClick={() => onProviderSelect(provider)}
              >
                <Stack spacing="xs">
                  <Text weight="medium">
                    {PROVIDER_DISPLAY_NAMES[provider.name] || provider.name}
                  </Text>
                  {PROVIDER_DISPLAY_NAMES[provider.name] && (
                    <Text size="xs" color="muted">
                      {provider.name}
                    </Text>
                  )}
                </Stack>
              </MenuItem>
            ))}
          </Menu>
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default ProviderSelector; 