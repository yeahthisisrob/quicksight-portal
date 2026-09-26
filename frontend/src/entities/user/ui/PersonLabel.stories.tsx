import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PersonLabel } from './PersonLabel';

/** How the portal names people: linked to their QuickSight user when one matched. */
const meta: Meta<typeof PersonLabel> = {
  title: 'Entities/User/PersonLabel',
  component: PersonLabel,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Kinds: Story = {
  render: () => (
    <Stack spacing={1.5} sx={{ p: 3 }}>
      <PersonLabel
        person={{
          label: 'rob@example.com',
          kind: 'person',
          email: 'rob@example.com',
          quickSightUserName: 'rob',
        }}
      />
      <PersonLabel person={{ label: 'google_1043', kind: 'person' }} />
      <PersonLabel person={{ label: 'claude-cli (API key)', kind: 'api-key' }} />
      <PersonLabel person={{ label: 'The portal', kind: 'portal' }} />
      <PersonLabel fallback="rob@example.com" />
    </Stack>
  ),
};
