import { Inbox as InboxIcon, SearchOff as SearchOffIcon } from '@mui/icons-material';
import { Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Container } from './Container';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Design System/EmptyState',
  component: EmptyState,
  parameters: {
    docs: {
      description: {
        component:
          'What a list shows instead of nothing. Says what would be here and what to do about it; never just "No data".',
      },
    },
  },
  decorators: [
    (Story) => (
      <Container sx={{ maxWidth: 640 }}>
        <Story />
      </Container>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: {
    icon: <InboxIcon />,
    title: 'No archived assets',
    description: 'Assets deleted through the portal are kept here so they can be restored.',
    action: <Button variant="outlined">Learn how archiving works</Button>,
  },
};

export const NoResults: Story = {
  args: {
    icon: <SearchOffIcon />,
    title: 'No assets match "orders_gld"',
    description: 'Check the spelling, or clear the filters to see everything.',
    action: <Button variant="text">Clear filters</Button>,
    compact: true,
  },
};
