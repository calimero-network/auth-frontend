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
import { isReachabilityMessage } from '../../utils/errors';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
  buttonText?: string;
  /**
   * Override the footer line. Pass `null` to show none — the default is
   * derived from the message and is right for every caller today.
   */
  hint?: string | null;
}

export function ErrorView({ message, onRetry, buttonText, hint }: ErrorViewProps) {
  /**
   * ⚠️ THE FOOTER USED TO SAY "check that your node is running and reachable"
   * UNCONDITIONALLY, which is the wrong advice for most of the errors that
   * reach this card and was actively harmful for one of them: installing an
   * application answered `HTTP 400 Bad Request` because the client was sending
   * a field core had deleted, and the screen told the reader to go and check a
   * node that had answered in milliseconds. Restarting it, of course, changed
   * nothing.
   *
   * So the connectivity advice is now given only where it could be true — a
   * request that never landed, or a 5xx — and a refused request says what it
   * actually was.
   */
  const footer =
    hint !== undefined
      ? hint
      : isReachabilityMessage(message)
        ? 'If the problem persists, check that your node is running and reachable.'
        : 'The node answered and refused this request — the message above is its own.';
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

            {footer && (
              <Text size="sm" color="muted">
                {footer}
              </Text>
            )}

            <Flex justify="flex-end">
              <Button
                variant="primary"
                onClick={handleAction}
                style={{
                  borderColor: 'var(--color-border-brand)',
                  color: '#000000',
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
