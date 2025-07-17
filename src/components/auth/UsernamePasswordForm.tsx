import React, { useState } from 'react';
import styled from 'styled-components';
import Button from '../common/Button';

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl};
  background-color: ${({ theme }) => theme.colors.background.secondary};
  border-radius: ${({ theme }) => theme.borderRadius.default};
  border: 1px solid ${({ theme }) => theme.colors.border.primary};
  max-width: 400px;
  width: 100%;
`;

const Title = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
  color: ${({ theme }) => theme.colors.text.primary};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.subtitle.size};
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Label = styled.label`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.small.size};
  font-weight: 500;
`;

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border.primary};
  border-radius: ${({ theme }) => theme.borderRadius.default};
  background-color: ${({ theme }) => theme.colors.background.tertiary};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.body.size};
  transition: ${({ theme }) => theme.transitions.default};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent.primary};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.secondary};
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.text.error};
  font-size: ${({ theme }) => theme.typography.small.size};
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

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
    <FormContainer>
      <Title>Sign In</Title>
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            disabled={loading}
            autoComplete="username"
          />
        </InputGroup>

        <InputGroup>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading}
            autoComplete="current-password"
          />
        </InputGroup>

        {displayError && <ErrorMessage>{displayError}</ErrorMessage>}

        <ButtonGroup>
          <Button 
            type="button" 
            onClick={onBack} 
            disabled={loading}
          >
            Back
          </Button>
          <Button 
            type="submit" 
            primary 
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
        </ButtonGroup>
      </form>
    </FormContainer>
  );
} 