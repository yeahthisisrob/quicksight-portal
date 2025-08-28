/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';

interface User {
  email?: string;
  name?: string;
  sub?: string;
  groups?: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: User;
  idToken?: string;
  login: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

// Mock auth context value for Storybook
export const mockAuthValue: AuthContextType = {
  user: {
    sub: 'mock-user-id',
    email: 'user@example.com',
    name: 'Mock User',
    groups: []
  },
  isAuthenticated: true,
  isLoading: false,
  idToken: 'mock-id-token',
  login: async () => {
    console.log('Mock login called');
  },
  logout: async () => {
    console.log('Mock logout called');
  },
  checkSession: async () => {
    console.log('Mock checkSession called');
  },
};

// Create the same context as the real AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Mock useAuth hook that matches the real implementation
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // In Storybook, we want to return the mock value instead of throwing
    return mockAuthValue;
  }
  return context;
};