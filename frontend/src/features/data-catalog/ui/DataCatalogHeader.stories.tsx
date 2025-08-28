import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import DataCatalogHeader from './DataCatalogHeader';
import { DataCatalogProvider } from '../model';

import type { Meta, StoryObj } from '@storybook/react-vite';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const meta = {
  title: 'Features/DataCatalog/DataCatalogHeader',
  component: DataCatalogHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Header component for the data catalog with view mode switcher and action buttons. Displays different views: Physical Fields, Visual Fields, Calculated Fields, and locked Semantic Layer and Field Mapping views.',
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <DataCatalogProvider>
          <Story />
        </DataCatalogProvider>
      </QueryClientProvider>
    ),
  ],
  argTypes: {
    viewMode: {
      control: 'select',
      options: ['physical', 'visual-fields', 'calculated', 'semantic', 'mapping'],
    },
  },
} satisfies Meta<typeof DataCatalogHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    viewMode: 'physical',
    onViewModeChange: () => {},
  },
};

export const PhysicalView: Story = {
  args: {
    viewMode: 'physical',
    onViewModeChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Physical fields view selected, showing the rebuild catalog button.',
      },
    },
  },
};

export const VisualFieldsView: Story = {
  args: {
    viewMode: 'visual-fields',
    onViewModeChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Visual fields view selected.',
      },
    },
  },
};

export const CalculatedFieldsView: Story = {
  args: {
    viewMode: 'calculated',
    onViewModeChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Calculated fields view selected.',
      },
    },
  },
};

export const WithRebuildingState: Story = {
  args: {
    viewMode: 'physical',
    onViewModeChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the header with catalog rebuilding in progress.',
      },
    },
  },
};