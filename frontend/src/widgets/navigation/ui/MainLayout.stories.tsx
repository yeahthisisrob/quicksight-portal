import { Box, Typography } from '@mui/material';

import MainLayout from './MainLayout';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Widgets/Navigation/MainLayout',
  component: MainLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main application layout with a permanent sidebar navigation and content area. The sidebar includes user profile and logout functionality at the bottom.',
      },
    },
  },
} satisfies Meta<typeof MainLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock some content for the outlet
const MockContent = () => (
  <Box>
    <Typography variant="h4" gutterBottom>
      Dashboard Assets
    </Typography>
    <Typography variant="body1" paragraph>
      This is the main content area. The sidebar navigation is permanently visible on the left,
      and the user profile with logout functionality is located at the bottom of the sidebar.
    </Typography>
    <Box sx={{ 
      mt: 3, 
      p: 3, 
      bgcolor: 'background.paper', 
      borderRadius: 1,
      boxShadow: 1 
    }}>
      <Typography variant="h6" gutterBottom>
        Key Features
      </Typography>
      <ul>
        <li>No mobile support - desktop only experience</li>
        <li>Clean, minimal layout without a top app bar</li>
        <li>User section integrated into sidebar</li>
        <li>Colorful active states for navigation items</li>
        <li>Gradient effects and modern styling</li>
      </ul>
    </Box>
  </Box>
);

export const Default: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', width: '100%', height: '100vh' }}>
        <Story />
        <Box sx={{ position: 'absolute', left: 240, top: 0, right: 0, p: 3 }}>
          <MockContent />
        </Box>
      </Box>
    ),
  ],
};