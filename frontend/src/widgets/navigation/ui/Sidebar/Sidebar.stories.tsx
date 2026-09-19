import { Box, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Sidebar } from './Sidebar';

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
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            The sidebar sits to the left of every page, under the top bar.
          </Typography>
        </Box>
      </Box>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  args: { currentPath: '/activity', onToggleCollapsed: () => {} },
};

export const Collapsed: Story = {
  args: { currentPath: '/activity', collapsed: true, onToggleCollapsed: () => {} },
};

/** Asset pages tint the indicator with the asset's colour. */
export const DashboardsActive: Story = {
  args: { currentPath: '/assets/dashboards', onToggleCollapsed: () => {} },
};

export const AuthorActive: Story = {
  args: { currentPath: '/author', onToggleCollapsed: () => {} },
};

/** Child routes keep the parent item active. */
export const OperationsChildRouteActive: Story = {
  args: { currentPath: '/operations/anything', onToggleCollapsed: () => {} },
};

export const SettingsActive: Story = {
  args: { currentPath: '/settings', onToggleCollapsed: () => {} },
};

function Toggling() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Sidebar
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
      currentPath="/assets/datasets"
    />
  );
}

export const Interactive: Story = {
  render: () => <Toggling />,
};
