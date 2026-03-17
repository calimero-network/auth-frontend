import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Flex,
  Stack,
  Text,
} from '@calimero-network/mero-ui';
import { tokens } from '@calimero-network/mero-tokens';
import { PageShell } from './PageShell';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
  buttonText?: string;
}

export function ErrorView({ message, onRetry, buttonText }: ErrorViewProps) {
  const handleAction = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <PageShell>
      <div data-testid="error-view">
      <Card
        variant="rounded"
        color={tokens.color.semantic.error.value}
        style={{ width: '100%' }}
      >
        <CardHeader>
          <Flex align="center" gap="sm">
            <span style={{ fontSize: '22px', lineHeight: 1 }}>⚠️</span>
            <CardTitle>Something went wrong</CardTitle>
          </Flex>
        </CardHeader>
        <CardContent>
          <Stack spacing="lg">
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: `${tokens.color.semantic.error.value}14`,
                border: `1px solid ${tokens.color.semantic.error.value}40`,
              }}
            >
              <Text size="sm" style={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                {message}
              </Text>
            </div>

            <Text size="sm" color="muted">
              If the problem persists, check that your node is running and reachable.
            </Text>

            <Flex justify="flex-end">
              <Button
                variant="primary"
                onClick={handleAction}
                style={{
                  borderColor: 'var(--color-border-brand)',
                  color: 'var(--color-text-brand)',
                }}
              >
                {buttonText || 'Try Again'}
              </Button>
            </Flex>
          </Stack>
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
