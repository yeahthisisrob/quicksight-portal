import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TopBar } from './TopBar';

/**
 * The bar with the development environment renders in every Pages story
 * (they run in the real app shell); production gets its own tone.
 */
const meta = {
  title: 'Widgets/Navigation/TopBar',
  component: TopBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The dark bar across the top: product name, environment, colour-scheme toggle, settings and the signed-in user. Navigation lives in the sidebar.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ height: 120, bgcolor: 'background.default', position: 'relative' }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Production: Story = {
  args: { environment: 'production', onToggleNavigation: () => {} },
};
