import { CssBaseline, ThemeProvider } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import type { Preview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { theme } from '../src/app/theme';
import { AuthProvider } from './mocks/providers';

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

type Scheme = 'light' | 'dark';

/**
 * The theme's colour scheme is owned by MUI's provider (it writes
 * `data-mui-color-scheme` on <html>), so the toolbar's choice is applied
 * through the same hook the app's top bar uses rather than by poking the
 * attribute from outside.
 */
function SchemeSync({ scheme }: { scheme: Scheme }) {
  const { mode, setMode } = useColorScheme();
  useEffect(() => {
    if (mode !== scheme) {
      setMode(scheme);
    }
  }, [scheme, mode, setMode]);
  return null;
}

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
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: ['Pages', 'Design System', 'Widgets', 'Features', 'Entities', 'Shared'],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      const scheme: Scheme = context.globals.theme === 'dark' ? 'dark' : 'light';
      // A page story sets `parameters.router.initialEntries` so the sidebar
      // highlights the right item and URL state (?tab=, ?type=) is honoured.
      const initialEntries: string[] = context.parameters.router?.initialEntries ?? ['/'];
      return (
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider theme={theme} defaultMode={scheme} modeStorageKey="sb-mui-mode">
                <SchemeSync scheme={scheme} />
                <CssBaseline />
                <SnackbarProvider maxSnack={3}>
                  <Story />
                </SnackbarProvider>
              </ThemeProvider>
            </QueryClientProvider>
          </AuthProvider>
        </MemoryRouter>
      );
    },
  ],
};

export default preview;
