import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AssetRelationshipSection } from './index';

const meta = {
  title: 'Shared/UI/AssetRelationshipSection',
  component: AssetRelationshipSection,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A section of related assets of one type, used in the RelatedAssetsDialog: view counts for dashboards and analyses, archived rows struck through, up to two tags plus an overflow chip.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Stack sx={{ width: 420 }}>
        <Story />
      </Stack>
    ),
  ],
  args: {
    type: 'dashboard',
    onAssetClick: () => {},
    assets: [
      {
        id: 'dash-001',
        name: 'Sales Dashboard',
        type: 'dashboard',
        activity: { totalViews: 1830 },
        tags: [
          { key: 'Owner', value: 'BI' },
          { key: 'Department', value: 'Sales and Operations' },
          { key: 'Tier', value: 'Gold' },
        ],
      },
      {
        id: 'dash-002',
        name: 'Comprehensive Customer Transaction History with Demographic and Behavioral Enrichment',
        type: 'dashboard',
        activity: { totalViews: 0 },
      },
      {
        id: 'dash-003',
        name: 'Operations Dashboard (retired)',
        type: 'dashboard',
        isArchived: true,
      },
    ],
  },
} satisfies Meta<typeof AssetRelationshipSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Views (busy and zero), tags with overflow, a long name and an archived row. */
export const Default: Story = {};

/** Nothing related of this type: the section fades out. */
export const Empty: Story = {
  args: { assets: [] },
};

/** Each type's colour and icon. */
export const AllTypes: Story = {
  render: (args) => (
    <Stack spacing={2}>
      <AssetRelationshipSection {...args} />
      <AssetRelationshipSection
        type="analysis"
        assets={[{ id: 'analysis-001', name: 'Revenue Analysis', type: 'analysis' }]}
        onAssetClick={args.onAssetClick}
      />
      <AssetRelationshipSection
        type="dataset"
        assets={[{ id: 'dataset-001', name: 'Sales Data 2024', type: 'dataset' }]}
        onAssetClick={args.onAssetClick}
      />
      <AssetRelationshipSection
        type="datasource"
        assets={[{ id: 'datasource-001', name: 'Production Database', type: 'datasource' }]}
        onAssetClick={args.onAssetClick}
      />
    </Stack>
  ),
};
