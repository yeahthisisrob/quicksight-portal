import type { Meta, StoryObj } from '@storybook/react-vite';

import RelatedAssetsDialog, { type LineageRelationship } from '../RelatedAssetsDialog';

const meta = {
  title: 'Widgets/AssetDialogs/RelatedAssetsDialog',
  component: RelatedAssetsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'An asset’s lineage in two columns, "Used By" and "Uses", grouped by type; dashboards and analyses are sorted by views, and archived assets hide behind a toggle.',
      },
    },
  },
  args: { open: true, onClose: () => {} },
} satisfies Meta<typeof RelatedAssetsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One lineage edge in the shape the asset list returns. */
const edge = (
  targetAssetId: string,
  targetAssetName: string,
  targetAssetType: 'dashboard' | 'analysis' | 'dataset' | 'datasource',
  relationshipType: 'uses' | 'used_by',
  extra: Partial<LineageRelationship> = {}
): LineageRelationship => ({
  targetAssetId,
  targetAssetName,
  targetAssetType,
  relationshipType,
  ...extra,
});

/** Activity on dependents, one never viewed, one archived, and an overlong name. */
export const Default: Story = {
  args: {
    assetName: 'Monthly Sales Analysis',
    assetType: 'dataset',
    relatedAssets: [
      edge('dash-002', 'Sales Performance Dashboard', 'dashboard', 'used_by', {
        activity: { totalViews: 850, uniqueViewers: 32, lastViewed: '2024-01-15T09:15:00Z' },
      }),
      edge('dash-001', 'Executive Summary Dashboard', 'dashboard', 'used_by', {
        activity: { totalViews: 1250, uniqueViewers: 45, lastViewed: '2024-01-15T14:30:00Z' },
      }),
      edge(
        'analysis-001',
        'Executive Summary with Extended Financial Metrics and Operational KPIs for Board Reporting',
        'analysis',
        'used_by',
        { activity: { totalViews: 420, uniqueViewers: 18, lastViewed: '2024-01-14T16:45:00Z' } }
      ),
      edge('analysis-003', 'Inactive Analysis', 'analysis', 'used_by', {
        activity: { totalViews: 0, uniqueViewers: 0, lastViewed: null },
      }),
      edge('analysis-004', 'Retired Forecast', 'analysis', 'used_by', { targetIsArchived: true }),
      edge('datasource-001', 'Production Database', 'datasource', 'uses'),
    ],
  },
};

export const NoRelatedAssets: Story = {
  args: {
    assetName: 'Standalone Report',
    assetType: 'analysis',
    relatedAssets: [],
  },
};
