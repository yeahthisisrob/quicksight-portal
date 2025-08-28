import { Box } from '@mui/material';
import { useState } from 'react';

import { TagFilterBar } from './TagFilterBar';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataCatalog/TagFilterBar',
  component: TagFilterBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A sleek tag filtering component for the data catalog that allows filtering assets by their tags.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof TagFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockTags = [
  { key: 'Environment', value: 'Production', count: 45 },
  { key: 'Environment', value: 'Development', count: 32 },
  { key: 'Environment', value: 'Staging', count: 18 },
  { key: 'Environment', value: 'Testing', count: 12 },
  { key: 'Environment', value: 'UAT', count: 8 },
  { key: 'BusinessUnit', value: 'Sales', count: 28 },
  { key: 'BusinessUnit', value: 'Marketing', count: 23 },
  { key: 'BusinessUnit', value: 'Operations', count: 35 },
  { key: 'BusinessUnit', value: 'Finance', count: 19 },
  { key: 'BusinessUnit', value: 'HR', count: 14 },
  { key: 'BusinessUnit', value: 'IT', count: 41 },
  { key: 'BusinessUnit', value: 'Engineering', count: 52 },
  { key: 'DataClassification', value: 'Public', count: 67 },
  { key: 'DataClassification', value: 'Internal', count: 89 },
  { key: 'DataClassification', value: 'Confidential', count: 34 },
  { key: 'DataClassification', value: 'Restricted', count: 12 },
  { key: 'Region', value: 'US-East', count: 78 },
  { key: 'Region', value: 'US-West', count: 45 },
  { key: 'Region', value: 'EU-Central', count: 23 },
  { key: 'Region', value: 'APAC', count: 29 },
  { key: 'Region', value: 'LATAM', count: 17 },
  { key: 'Owner', value: 'DataTeam', count: 43 },
  { key: 'Owner', value: 'Analytics', count: 37 },
  { key: 'Owner', value: 'Engineering', count: 56 },
  { key: 'Owner', value: 'ProductTeam', count: 31 },
  { key: 'Owner', value: 'MarketingTeam', count: 25 },
  { key: 'CostCenter', value: 'CC-1001', count: 22 },
  { key: 'CostCenter', value: 'CC-1002', count: 18 },
  { key: 'CostCenter', value: 'CC-1003', count: 15 },
  { key: 'CostCenter', value: 'CC-2001', count: 28 },
  { key: 'CostCenter', value: 'CC-2002', count: 24 },
  { key: 'Project', value: 'Project-Alpha', count: 39 },
  { key: 'Project', value: 'Project-Beta', count: 31 },
  { key: 'Project', value: 'Project-Gamma', count: 26 },
  { key: 'Project', value: 'Project-Delta', count: 19 },
];

export const Default: Story = {
  args: {
    availableTags: mockTags,
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    isLoading: false,
  },
};

export const WithActiveFilter: Story = {
  render: (args) => {
    const [, setFilter] = useState<{ key: string; value: string } | null>({
      key: 'BusinessUnit',
      value: 'Operations',
    });

    return (
      <TagFilterBar
        {...args}
        onFilterChange={(newFilter) => {
          setFilter(newFilter);
          console.log('Filter changed:', newFilter);
        }}
      />
    );
  },
  args: {
    availableTags: mockTags,
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    availableTags: [],
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    isLoading: true,
  },
};

export const NoTags: Story = {
  args: {
    availableTags: [],
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    isLoading: false,
  },
};

export const ManyTags: Story = {
  args: {
    availableTags: [
      ...mockTags,
      ...Array.from({ length: 50 }, (_, i) => ({
        key: 'Application',
        value: `App-${i + 1}`,
        count: Math.floor(Math.random() * 20) + 1,
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        key: 'Team',
        value: `Team-${i + 1}`,
        count: Math.floor(Math.random() * 15) + 1,
      })),
    ],
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    isLoading: false,
  },
};

export const Interactive: Story = {
  args: {
    availableTags: mockTags,
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    isLoading: false,
  },
  render: (args) => {
    const [filter, setFilter] = useState<{ key: string; value: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFilterChange = (newFilter: { key: string; value: string } | null) => {
      setIsLoading(true);
      setFilter(newFilter);
      
      // Simulate API call
      setTimeout(() => {
        setIsLoading(false);
        console.log('Filter applied:', newFilter);
      }, 1000);
    };

    return (
      <Box>
        <TagFilterBar
          {...args}
          onFilterChange={handleFilterChange}
          isLoading={isLoading}
        />
        
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <strong>Current Filter:</strong>{' '}
          {filter ? `${filter.key} = ${filter.value}` : 'None'}
        </Box>
      </Box>
    );
  },
};