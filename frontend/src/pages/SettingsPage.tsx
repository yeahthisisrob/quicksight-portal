import { Box, Stack } from '@mui/material';

import { ApiKeysPanel, SettingsForm } from '@/features/settings';

import { PageHeader } from '@/shared/design-system';

/**
 * Portal settings. Values live in DynamoDB and fall back to the Lambda's
 * environment, so a fresh deployment works from env vars alone and a
 * migration can move them one at a time.
 */
export default function SettingsPage() {
  return (
    <Box sx={{ maxWidth: 1040 }}>
      <PageHeader
        title="Settings"
        description="Stored settings override the environment. Clear one to fall back to the environment variable it names."
      />
      <Stack spacing={3}>
        <SettingsForm />
        <ApiKeysPanel />
      </Stack>
    </Box>
  );
}
