import React from 'react';
import { Loader as DSLoader } from '@calimero-network/mero-ui';

interface LoaderProps {
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ className }) => {
  return (
    <div 
      className={className} 
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <DSLoader size="large" />
    </div>
  );
};

export default Loader;
