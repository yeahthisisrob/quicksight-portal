import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/app/providers';

import { config } from '@/shared/config';

interface AuthMethod {
  id: string;
  name: string;
  description: string;
  configured: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Check if already authenticated
    if (isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // Check for error in URL params
    const errorParam = searchParams.get('error');
    if (errorParam === 'session_expired') {
      setError('Your session has expired. Please sign in again.');
    } else if (errorParam === 'code_already_used') {
      setError('This login attempt has already been processed. Please try signing in again.');
    } else if (errorParam === 'token_exchange_failed') {
      setError('Failed to complete authentication. Please try signing in again.');
    } else if (errorParam === 'no_code') {
      setError('Missing authorization code. Please try signing in again.');
    } else if (errorParam === 'no_token') {
      setError('Authentication incomplete. Please try signing in again.');
    } else if (errorParam === 'timeout') {
      setError('Authentication timed out. Please try signing in again.');
    } else if (errorParam === 'callback_error') {
      setError('An error occurred during authentication. Please try again.');
    } else if (errorParam) {
      setError('Authentication failed. Please try again.');
    }

    // Initialize auth methods
    initializeAuth();
  }, [isAuthenticated, navigate, searchParams]);

  const initializeAuth = () => {
    setAuthMethods([
      {
        id: 'cognito',
        name: 'Sign in with AWS Cognito', 
        description: 'Sign in using your AWS Cognito credentials',
        configured: true,
      }
    ]);
    setLoading(false);
  };

  const handleCognitoLogin = () => {
    // Redirect directly to Cognito Hosted UI
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/cognito/callback');
    const cognitoUrl = `${config.COGNITO_DOMAIN}/login?client_id=${config.USER_POOL_CLIENT_ID}&response_type=code&scope=openid+email+profile&redirect_uri=${redirectUri}`;
    window.location.href = cognitoUrl;
  };

  const handleLogin = (methodId: string) => {
    setError(null);
    
    switch (methodId) {
      case 'cognito':
        handleCognitoLogin();
        break;
      default:
        setError(`Unknown authentication method: ${methodId}`);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        bgcolor: 'grey.50',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            QuickSight Assets Portal
          </Typography>
          
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Sign in to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2}>
            {authMethods.map((method) => (
              <Button
                key={method.id}
                variant="contained"
                fullWidth
                onClick={() => handleLogin(method.id)}
                disabled={!method.configured}
              >
                {method.name}
              </Button>
            ))}
          </Stack>

          {authMethods.length === 0 && (
            <Alert severity="warning">
              No authentication methods configured. Please check your environment configuration.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}