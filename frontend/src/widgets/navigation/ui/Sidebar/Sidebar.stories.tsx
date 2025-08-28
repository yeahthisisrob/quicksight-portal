import { Box } from '@mui/material';

import { Sidebar } from './Sidebar';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Widgets/Navigation/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A permanent navigation sidebar with colorful active states and a user section at the bottom for profile info and logout.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <h2>Main Content Area</h2>
          <p>The sidebar provides navigation between different sections of the application.</p>
        </Box>
      </Box>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DashboardsActive: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <h2>Dashboards Page</h2>
          <p>The Dashboards menu item is highlighted with the dashboard color.</p>
        </Box>
      </Box>
    ),
  ],
};

export const AnalysesActive: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <h2>Analyses Page</h2>
          <p>The Analyses menu item is highlighted with the analysis color.</p>
        </Box>
      </Box>
    ),
  ],
};

export const DatasetsActive: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <h2>Datasets Page</h2>
          <p>The Datasets menu item is highlighted with the dataset color.</p>
        </Box>
      </Box>
    ),
  ],
};

export const UsersActive: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <h2>Users Page</h2>
          <p>The Users menu item is highlighted with the user color.</p>
        </Box>
      </Box>
    ),
  ],
};

export const DataCatalogActive: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
        <Story />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <h2>Data Catalog Page</h2>
          <p>The Data Catalog menu item is highlighted.</p>
        </Box>
      </Box>
    ),
  ],
};