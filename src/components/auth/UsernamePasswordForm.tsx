import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Flex,
  Form,
  FormField,
  Input,
  Stack,
} from '@calimero-network/mero-ui';

interface UsernamePasswordFormProps {
  onSubmit: (username: string, password: string) => void;
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

    onSubmit(username.trim(), password);
  };

  const displayError = validationError || error;

  return (
    <div style={{ 
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 420,
      width: '100%',
      padding: '0 16px',
    }}>
      <Card variant="rounded" color="var(--color-border-brand)">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <Form onSubmit={handleSubmit}>
            <Stack spacing="lg">
              {displayError && (
                <Alert variant="error" size="sm">
                  {displayError}
                </Alert>
              )}

              <FormField label="Username" required>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={loading}
                  autoComplete="username"
                />
              </FormField>

              <FormField label="Password" required>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </FormField>

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
                    color: 'var(--color-text-brand)',
                    borderColor: 'var(--color-border-brand)',
                  }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </Flex>
            </Stack>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 