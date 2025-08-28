/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User>();
  const [idToken, setIdToken] = useState<string>();

  const checkSession = useCallback(async () => {
    try {
      // Get ID token from localStorage
      const storedIdToken = localStorage.getItem('idToken');
      if (!storedIdToken) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Decode and validate the ID token
      try {
        const tokenParts = storedIdToken.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token format');
        }

        const payload = JSON.parse(atob(tokenParts[1]));
        
        // Check if token is expired
        if (payload.exp && payload.exp < Date.now() / 1000) {
          localStorage.removeItem('idToken');
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        const userInfo = {
          email: payload.email,
          name: payload.name,
          sub: payload.sub,
          groups: payload['cognito:groups'],
        };

        setUser(userInfo);
        setIsAuthenticated(true);
        setIdToken(storedIdToken);
      } catch (_error) {
        localStorage.removeItem('idToken');
        setIsAuthenticated(false);
      }
    } catch (_error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (newIdToken: string) => {
    try {
      localStorage.setItem('idToken', newIdToken);
      setIdToken(newIdToken);
      
      // Decode token and set user info
      const tokenParts = newIdToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        setUser({
          email: payload.email,
          name: payload.name,
          sub: payload.sub,
          groups: payload['cognito:groups'],
        });
      }
      
      setIsAuthenticated(true);
      setIsLoading(false);
    } catch (_error) {
      // Clean up on failure
      localStorage.removeItem('idToken');
      setIsAuthenticated(false);
      setIsLoading(false);
      setUser(undefined);
      setIdToken(undefined);
      throw _error;
    }
  }, []);

  const logout = async () => {
    localStorage.removeItem('idToken');
    setIsAuthenticated(false);
    setUser(undefined);
    setIdToken(undefined);
    window.location.href = '/login';
  };

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      idToken,
      login,
      logout,
      checkSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}