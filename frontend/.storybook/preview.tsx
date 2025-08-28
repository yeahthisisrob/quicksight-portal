import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { MemoryRouter } from 'react-router-dom';

import { theme } from '../src/theme';
import { AuthProvider } from './mocks/providers';

import type { Preview } from '@storybook/react-vite';

// Declare global APP_CONFIG type
declare global {
  interface Window {
    APP_CONFIG: {
      API_URL: string;
      AWS_REGION: string;
      USER_POOL_ID: string;
      USER_POOL_CLIENT_ID: string;
      COGNITO_DOMAIN: string;
      ENVIRONMENT: string;
    };
  }
}

// Mock APP_CONFIG for Storybook
if (!window.APP_CONFIG) {
  window.APP_CONFIG = {
    API_URL: 'http://localhost:3000/api',
    AWS_REGION: 'us-east-1',
    USER_POOL_ID: 'mock-user-pool-id',
    USER_POOL_CLIENT_ID: 'mock-client-id',
    COGNITO_DOMAIN: 'mock-cognito-domain',
    ENVIRONMENT: 'development',
  };
}

// Create a default query client for stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <SnackbarProvider maxSnack={3}>
                <Story />
              </SnackbarProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </AuthProvider>
      </MemoryRouter>
    ),
  ],
};

export default preview;