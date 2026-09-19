import { Button, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Container } from './Container';
import { KeyValuePairs } from './KeyValuePairs';
import { StatusIndicator } from './StatusIndicator';

const meta: Meta<typeof Container> = {
  title: 'Design System/Container',
  component: Container,
  parameters: {
    docs: {
      description: {
        component:
          'The basic surface everything sits on: a bordered card with a 16px radius and an optional header row with description and actions. Nest sections as separate Containers rather than dividing one with rules.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    header: 'Dataset details',
    description: 'Where this dataset reads from and who can use it.',
    children: (
      <KeyValuePairs
        items={[
          { label: 'Import mode', value: 'SPICE' },
          { label: 'Last refreshed', value: '2 hours ago' },
          { label: 'Owner', value: 'analytics-team' },
          { label: 'Status', value: <StatusIndicator type="success">Available</StatusIndicator> },
        ]}
      />
    ),
  },
};

export const WithActionsAndFooter: Story = {
  args: {
    header: 'Published assets',
    headerAdornment: <Typography color="text.secondary">(12)</Typography>,
    description: 'Assets published from the selected SMUS projects.',
    actions: (
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" color="inherit" size="small">
          Refresh
        </Button>
        <Button variant="contained" size="small">
          Create dataset
        </Button>
      </Stack>
    ),
    footer: (
      <Typography variant="body2" color="text.secondary">
        Showing the first 50. Refine the search to see more.
      </Typography>
    ),
    children: <Typography>Table or list content goes here.</Typography>,
  },
};

export const Subtle: Story = {
  args: {
    variant: 'subtle',
    header: 'Advanced',
    headingLevel: 'h3',
    children: <Typography>A quieter container for secondary content.</Typography>,
  },
};

export const NoHeader: Story = {
  args: {
    disableContentPadding: true,
    children: (
      <Typography sx={{ p: 2 }}>
        Content-only, with padding handled by the child (a table, a canvas).
      </Typography>
    ),
  },
};
