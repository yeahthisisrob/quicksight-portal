/* eslint-disable react-refresh/only-export-components */
import React from 'react';

import { MockAuthProvider, useAuth } from './auth';

// Re-export the mocked auth components with the same names as the real ones
export { useAuth };
export const AuthProvider = MockAuthProvider;

// Mock AuthGuard component
export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  // In Storybook, always render children (no auth check needed)
  return <>{children}</>;
};

// Mock AuthenticatedApp component
export const AuthenticatedApp = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};