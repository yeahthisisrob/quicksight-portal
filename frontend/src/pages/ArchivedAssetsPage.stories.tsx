import { Box } from '@mui/material';

import { ArchivedAssetsPage } from './ArchivedAssetsPage';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Pages/ArchivedAssetsPage',
  component: ArchivedAssetsPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A page for viewing and managing archived QuickSight assets. Shows all deleted assets across all asset types with archive metadata including when and why they were archived.',
      },
    },
  },
  decorators: [
    (Story) => (
          <Box sx={{ display: 'flex', width: '100%', height: '100vh' }}>
            <Box
              component="nav"
              sx={{ width: 240, flexShrink: 0 }}
            >
              {/* Sidebar would be here in the actual app */}
            </Box>
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                overflow: 'auto',
              }}
            >
              <Story />
            </Box>
          </Box>
    ),
  ],
} satisfies Meta<typeof ArchivedAssetsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The default archived assets page showing all archived assets with server-side pagination and filtering.',
      },
    },
  },
};

export const FilteredByType: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Archived assets page with asset type filter applied, showing only specific asset types.',
      },
    },
  },
};

export const WithSearch: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Archived assets page with active search, demonstrating the search functionality across asset names, IDs, and archive reasons.',
      },
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Archived assets page with no archived assets, showing the empty state.',
      },
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Archived assets page in loading state, showing loading indicators.',
      },
    },
  },
};

export const WithManyAssets: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Archived assets page with many assets, demonstrating pagination functionality.',
      },
    },
  },
};

export const ErrorState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Archived assets page with error state, showing error handling.',
      },
    },
  },
};

export const MobileResponsive: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
    docs: {
      description: {
        story: 'Archived assets page on mobile viewport, demonstrating responsive layout.',
      },
    },
  },
};