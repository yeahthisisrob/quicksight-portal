import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/app/providers';

import { exchangeCodeForTokens } from '@/shared/api';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const idToken = params.get('idToken');

        const token = code 
          ? await exchangeCodeForTokens(code) 
          : idToken;
          
        if (!token) {
          navigate('/login?error=no_token', { replace: true });
          return;
        }

        await login(token);
        navigate('/', { replace: true });
      } catch (_error) {
        navigate('/login?error=callback_error', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, location, login]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="h6">Completing authentication...</Typography>
      <Typography variant="body2" color="text.secondary">
        Please wait while we set up your session.
      </Typography>
    </Box>
  );
}
