import { ErrorView as DSErrorView } from '@calimero-network/mero-ui';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
  buttonText?: string;
}

export function ErrorView({ message, onRetry, buttonText }: ErrorViewProps) {
  const handleRefresh = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div data-testid="error-view">
      <DSErrorView
        message={message}
        actionLabel={buttonText || 'Try Again'}
        onAction={handleRefresh}
        showAction
      />
    </div>
  );
}
