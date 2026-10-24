import React from 'react';
import { ErrorView } from './ErrorView';

// Admin may only be granted through the dedicated admin login, never from
// permissions a link or app supplied for an application login.
export function AdminRefused() {
  return (
    <ErrorView
      message="This request asks for the admin permission, which an application login cannot grant."
      hint="No token was issued. Admin access is only available through the dedicated admin login."
      buttonText="Go back"
      onRetry={() => window.history.back()}
    />
  );
}
