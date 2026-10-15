import { Box } from '@mui/material';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiKeysPanel, AthenaAccessPanel, SettingsForm } from '@/features/settings';

import { PageHeader } from '@/shared/design-system';

/**
 * Portal settings. Values live in DynamoDB and fall back to the Lambda's
 * environment, so a fresh deployment works from env vars alone and a
 * migration can move them one at a time. One section is open at a time,
 * named in the URL (?section=) so a link lands on it.
 */
export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') ?? undefined;
  const setSection = useCallback(
    (next: string) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          updated.set('section', next);
          return updated;
        },
        { replace: true }
      );
    },
    [setParams]
  );
  return (
    <Box sx={{ maxWidth: 1240 }}>
      <PageHeader
        title="Settings"
        description="Stored settings override the environment. Clear one to fall back to the environment variable it names."
      />
      <SettingsForm
        section={section}
        onSectionChange={setSection}
        panels={[
          { id: 'athena', label: 'Athena access', node: <AthenaAccessPanel /> },
          { id: 'keys', label: 'API keys', node: <ApiKeysPanel /> },
        ]}
      />
    </Box>
  );
}
