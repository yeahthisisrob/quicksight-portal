import { Box, Stack, Typography } from '@mui/material';

import { AssetSourcesCell, AssetSource } from './AssetSourcesCell';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AssetSourcesCell> = {
  title: 'Shared/UI/DataGrid/Cells/AssetSourcesCell',
  component: AssetSourcesCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A reusable cell component for displaying asset sources with tooltips. Groups sources by asset type and shows counts with asset names in tooltips.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    sources: {
      control: 'object',
      description: 'Array of asset sources',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleSources: AssetSource[] = [
  { assetType: 'dataset', assetId: 'ds-1', assetName: 'Sales Dataset' },
  { assetType: 'dataset', assetId: 'ds-2', assetName: 'Customer Dataset' },
  { assetType: 'analysis', assetId: 'an-1', assetName: 'Revenue Analysis' },
  { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
  { assetType: 'dashboard', assetId: 'db-2', assetName: 'Executive Dashboard' },
];

export const Default: Story = {
  args: {
    sources: sampleSources,
  },
};

export const DatasetsOnly: Story = {
  args: {
    sources: [
      { assetType: 'dataset', assetId: 'ds-1', assetName: 'Sales Data' },
      { assetType: 'dataset', assetId: 'ds-2', assetName: 'Customer Data' },
      { assetType: 'dataset', assetId: 'ds-3', assetName: 'Product Data' },
    ],
  },
};

export const AnalysesOnly: Story = {
  args: {
    sources: [
      { assetType: 'analysis', assetId: 'an-1', assetName: 'Q4 Analysis' },
    ],
  },
};

export const DashboardsOnly: Story = {
  args: {
    sources: [
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
      { assetType: 'dashboard', assetId: 'db-2', assetName: 'KPI Dashboard' },
    ],
  },
};

export const AllTypes: Story = {
  args: {
    sources: sampleSources,
  },
};

export const WithoutNames: Story = {
  args: {
    sources: [
      { assetType: 'dataset', assetId: 'ds-abc123-def456' },
      { assetType: 'analysis', assetId: 'an-xyz789-ghi012' },
    ],
  },
};

export const EmptySources: Story = {
  args: {
    sources: [],
  },
};

export const SingleSourceEach: Story = {
  args: {
    sources: [
      { assetType: 'dataset', assetId: 'ds-1', assetName: 'Main Dataset' },
      { assetType: 'analysis', assetId: 'an-1', assetName: 'Main Analysis' },
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Main Dashboard' },
    ],
  },
};

const StorySection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1, fontWeight: 500 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export const AllVariants: Story = {
  render: () => (
    <Stack spacing={4} sx={{ minWidth: 400 }}>
      <StorySection title="Empty Sources">
        <AssetSourcesCell sources={[]} />
        <Typography variant="caption" color="text.secondary">
          Nothing rendered
        </Typography>
      </StorySection>

      <StorySection title="Datasets Only (hover for tooltip)">
        <AssetSourcesCell
          sources={[
            { assetType: 'dataset', assetId: 'ds-1', assetName: 'Sales Data' },
            { assetType: 'dataset', assetId: 'ds-2', assetName: 'Customer Data' },
          ]}
        />
      </StorySection>

      <StorySection title="Single Analysis">
        <AssetSourcesCell
          sources={[
            { assetType: 'analysis', assetId: 'an-1', assetName: 'Revenue Analysis' },
          ]}
        />
      </StorySection>

      <StorySection title="Multiple Dashboards">
        <AssetSourcesCell
          sources={[
            { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
            { assetType: 'dashboard', assetId: 'db-2', assetName: 'Executive Dashboard' },
            { assetType: 'dashboard', assetId: 'db-3', assetName: 'Operations Dashboard' },
          ]}
        />
      </StorySection>

      <StorySection title="All Asset Types">
        <AssetSourcesCell sources={sampleSources} />
      </StorySection>

      <StorySection title="Without Asset Names (shows IDs)">
        <AssetSourcesCell
          sources={[
            { assetType: 'dataset', assetId: 'ds-abc123-def456-ghi789' },
            { assetType: 'analysis', assetId: 'an-xyz789-jkl012-mno345' },
          ]}
        />
      </StorySection>

      <StorySection title="Large Counts">
        <AssetSourcesCell
          sources={[
            ...Array.from({ length: 10 }, (_, i) => ({
              assetType: 'dataset' as const,
              assetId: `ds-${i}`,
              assetName: `Dataset ${i + 1}`,
            })),
            ...Array.from({ length: 5 }, (_, i) => ({
              assetType: 'analysis' as const,
              assetId: `an-${i}`,
              assetName: `Analysis ${i + 1}`,
            })),
            ...Array.from({ length: 15 }, (_, i) => ({
              assetType: 'dashboard' as const,
              assetId: `db-${i}`,
              assetName: `Dashboard ${i + 1}`,
            })),
          ]}
        />
      </StorySection>
    </Stack>
  ),
};
