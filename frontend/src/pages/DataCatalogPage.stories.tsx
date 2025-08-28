import { Box } from '@mui/material';

import DataCatalogPage from './DataCatalogPage';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Pages/DataCatalogPage',
  component: DataCatalogPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A comprehensive data catalog page for exploring fields, mappings, and metadata across QuickSight assets. Features multiple views (Physical, Visual, Calculated fields) with modern styling, advanced filtering, and interactive data exploration capabilities.',
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
} satisfies Meta<typeof DataCatalogPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The default data catalog page showing the Physical Fields view with modern styling and comprehensive data visualization.',
      },
    },
  },
};

export const PhysicalFieldsView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Physical fields view showing all fields from datasets and analyses with their data types, sources, and mapping status. Features include field type indicators, variant warnings, and calculated field markers.',
      },
    },
  },
};

export const VisualFieldsView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Visual fields view displaying field usage across dashboards and analyses, including visual types and asset distribution. Shows how fields are used in different visualizations.',
      },
    },
  },
};

export const CalculatedFieldsView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Calculated fields view showing field expressions, dependencies, and variant analysis. Includes export functionality and expression complexity metrics.',
      },
    },
  },
};

export const WithSearchActive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Data catalog with active search filtering, demonstrating the modern search bar with hover effects and real-time filtering across different field types.',
      },
    },
  },
};

export const WithStatsCards: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Data catalog showcasing the statistics cards with gradient effects, hover animations, and data type distribution charts.',
      },
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Data catalog in loading state, showing loading indicators and skeleton states for data fetching.',
      },
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Data catalog with no data, showing empty state messaging and zero statistics.',
      },
    },
  },
};

export const WithRebuildingCatalog: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Data catalog with catalog rebuilding in progress, showing the animated progress bar and disabled state.',
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
        story: 'Data catalog on mobile viewport, demonstrating responsive layout and touch-friendly interactions.',
      },
    },
  },
};

export const WithDialogsOpen: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Data catalog with various dialogs open, demonstrating field details, mapping configuration, and other modal interactions with modern styling.',
      },
    },
  },
};