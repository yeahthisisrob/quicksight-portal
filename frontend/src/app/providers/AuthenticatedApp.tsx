import React from 'react';

import { AssetsProvider } from '@/entities/asset';

interface AuthenticatedAppProps {
  children: React.ReactNode;
}

export const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ children }) => {
  return (
    <AssetsProvider>
      {children}
    </AssetsProvider>
  );
};