import React from 'react';
import { Loader as DSLoader } from '@calimero-network/mero-ui';
import { PageShell } from './PageShell';

interface LoaderProps {
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ className }) => {
  return (
    <PageShell>
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 0',
        }}
      >
        <DSLoader size="large" />
      </div>
    </PageShell>
  );
};

export default Loader;
