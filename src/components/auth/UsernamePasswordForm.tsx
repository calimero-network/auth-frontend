import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Flex,
  Input,
  Stack,
  Text,
} from '@calimero-network/mero-ui';
import { PageShell } from '../common/PageShell';

interface UsernamePasswordFormProps {
  onSubmit: (username: string, password: string, setupCode?: string) => void;
  onBack: () => void;
  loading?: boolean;
  error?: string | null;
}

export function UsernamePasswordForm({
  onSubmit,
  onBack,
  loading = false,
  error = null
}: UsernamePasswordFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // First-login setup code (core#3221): a fresh node only creates its first
  // account when the login presents the code merod printed at startup (also
  // in the node's config.toml). Hidden by default — an existing user never
  // needs it — but revealed on demand, and automatically after a failed
  // sign-in, because a fresh node reports a missing code as the same
  // "Invalid username or password" a typo produces.
  const [setupCode, setSetupCode] = useState('');
  const [showSetupCode, setShowSetupCode] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Basic validation
    if (!username.trim()) {
      setValidationError('Username is required');
      return;
    }

    if (!password.trim()) {
      setValidationError('Password is required');
      return;
    }

    if (password.length < 1) {
      setValidationError('Password must be at least 1 character long');
      return;
    }

    onSubmit(username.trim(), password, setupCode.trim() || undefined);
  };

  const displayError = validationError || error;
  const setupCodeVisible = showSetupCode || Boolean(error);

  return (
    <PageShell>
      <Card variant="rounded" color="var(--color-border-brand)">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Stack spacing="lg">
              {displayError && (
                <Alert variant="error">
                  {displayError}
                </Alert>
              )}

              <Stack spacing="xs">
                <Text size="sm" weight="medium">
                  Username <span style={{ color: 'var(--color-text-error, #ef4444)' }}>*</span>
                </Text>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={loading}
                  autoComplete="username"
                />
              </Stack>

              <Stack spacing="xs">
                <Text size="sm" weight="medium">
                  Password <span style={{ color: 'var(--color-text-error, #ef4444)' }}>*</span>
                </Text>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </Stack>

              {setupCodeVisible ? (
                <Stack spacing="xs">
                  <Text size="sm" weight="medium">
                    Setup code (first login only)
                  </Text>
                  <Input
                    id="setup-code"
                    type="text"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    placeholder="Code from the node's startup log"
                    disabled={loading}
                    autoComplete="off"
                  />
                  <Text size="xs" color="muted">
                    Setting up a fresh node? Its first account can only be
                    created with the setup code shown in the node's startup
                    log (and stored in its config.toml). Existing accounts
                    sign in without it.
                  </Text>
                </Stack>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSetupCode(true)}
                  disabled={loading}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-text-muted, #9ca3af)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  First login on a fresh node? Enter its setup code
                </button>
              )}

              <Flex justify="flex-end" gap="sm">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBack}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || !username.trim() || !password.trim()}
                  style={{
                    backgroundColor: '#A5FF11',
                    color: '#0A0E13',
                    border: 'none',
                  }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </Flex>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
