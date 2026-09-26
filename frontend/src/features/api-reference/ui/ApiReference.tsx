/**
 * Every operation in the contract the API serves, rendered by Scalar - the
 * standard open-source OpenAPI reference (search, schemas, request samples
 * in several languages, try-it). It follows the portal's light or dark mode,
 * and scrolls inside its own panel so its sidebar and search stay in reach.
 */
import '@scalar/api-reference-react/style.css';

import { Box, useTheme } from '@mui/material';
import { ApiReferenceReact } from '@scalar/api-reference-react';

import { Container } from '@/shared/design-system';

const PANEL_HEIGHT = '80vh';

export function ApiReference({ spec, baseUrl }: { spec: object; baseUrl: string }) {
  const theme = useTheme();
  return (
    <Container
      header="Every operation"
      description="The contract the API serves and validates against, with request samples and a try-it that runs against this portal."
    >
      <Box
        data-testid="api-reference"
        sx={{
          height: PANEL_HEIGHT,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <ApiReferenceReact
          configuration={{
            content: spec,
            servers: [{ url: baseUrl, description: 'This portal' }],
            forceDarkModeState: theme.palette.mode === 'dark' ? 'dark' : 'light',
            hideDarkModeToggle: true,
            withDefaultFonts: false,
            // Scalar's hosted extras (its cloud toolbar, its own AI chat) do not
            // belong here: the portal has its assistant.
            showDeveloperTools: 'never',
            agent: { disabled: true },
            layout: 'modern',
            metaData: { title: 'QuickSight Assets Portal API' },
          }}
        />
      </Box>
    </Container>
  );
}
