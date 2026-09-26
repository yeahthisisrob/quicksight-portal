import { Box, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Sidebar } from './Sidebar';

/**
 * The expanded sidebar with a page highlighted renders in every Pages story
 * (they run in the real app shell); these cover what those do not.
 */
const meta = {
  title: 'Widgets/Navigation/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The side navigation: sections with small headers, a blue (or asset-coloured) active indicator, Settings pinned to the bottom, and a collapsed icon-only mode with tooltips. The current page is announced through aria-current.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <Typography variant="h2">Page content</Typography>
        </Box>
      </Box>
    ),
  ],
  args: { onToggleCollapsed: () => {} },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Asset pages tint the indicator with the asset's colour. */
export const DashboardsActive: Story = {
  args: { currentPath: '/assets/dashboards' },
};

export const Collapsed: Story = {
  args: { currentPath: '/assets/dashboards', collapsed: true },
};
