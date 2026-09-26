/**
 * The Author page's API tab: how to use an agent with a key, the keys
 * themselves (a slot the page fills from Settings), where this is heading,
 * and every operation. Loaded lazily by the page: the contract it reads is
 * a few hundred kilobytes the Studio tab never needs.
 */
import { Box, Stack, Typography } from '@mui/material';
import spec from '@shared/generated/openapi.json';
import type { ReactNode } from 'react';

import { ApiQuickStart } from './ApiQuickStart';
import { ApiReference } from './ApiReference';
import { AwsContextNote } from './AwsContextNote';

export interface ApiTabProps {
  /** The API keys panel, owned by Settings; the page passes it in. */
  keysPanel?: ReactNode;
  /** This portal's origin; defaults to the page's. */
  origin?: string;
}

export default function ApiTab({ keysPanel, origin }: ApiTabProps) {
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Author by API
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Everything the Studio does is a call a key can make. Read what the portal knows, build the
          change with whatever you like, and publish it back through the same checks.
        </Typography>
      </Box>
      <Stack spacing={3}>
        <ApiQuickStart origin={base} />
        {keysPanel}
        <AwsContextNote />
        <ApiReference spec={spec} baseUrl={base} />
      </Stack>
    </Box>
  );
}
