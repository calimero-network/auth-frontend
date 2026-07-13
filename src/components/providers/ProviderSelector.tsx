import React from 'react';
interface Provider { name: string; type: string; description?: string; configured?: boolean; config?: Record<string, unknown>; [key: string]: unknown; }
import {
  Button,
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
  onRetry?: () => void;
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
  onRetry,
}) => {
  if (loading) {
    return <Loader />;
  }

  if (providers.length === 0) {
    // An empty list can mean two very different things: the node genuinely
    // has no providers configured, or the providers request itself failed
    // (node unreachable, proxy error, ...). Don't present a failed request
    // as "nothing is configured" — and always offer a way out.
    return (
      <PageShell>
        <Card variant="rounded" color="var(--color-border-brand)">
          <CardContent>
            <EmptyState
              title={error ? 'Unable to load providers' : 'No providers available'}
              description={
                error
                  ? `Could not fetch authentication providers from the node: ${error}`
                  : 'No authentication providers are configured on this node.'
              }
              variant="minimal"
            />
            <Stack spacing="sm" align="center" style={{ marginTop: '12px' }}>
              {onRetry ? (
                <Button onClick={onRetry}>Retry</Button>
              ) : (
                <Button onClick={() => window.location.reload()}>Reload</Button>
              )}
            </Stack>
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