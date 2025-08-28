import AssetTypeProgress from './AssetTypeProgress';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataExport/AssetTypeProgress',
  component: AssetTypeProgress,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof AssetTypeProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    assetTypes: {
      dashboards: {
        total: 125,
        listed: 125,
        enriched: 89,
        failed: 0,
        needsEnrichment: 36,
        phase: 'enriching',
        currentBatch: 3,
        totalBatches: 5,
      },
      datasets: {
        total: 89,
        listed: 89,
        enriched: 89,
        failed: 0,
        needsEnrichment: 0,
        phase: 'completed',
      },
      analyses: {
        total: 234,
        listed: 234,
        enriched: 0,
        failed: 0,
        needsEnrichment: 234,
        phase: 'listing',
      },
    },
  },
};

export const AllCompleted: Story = {
  args: {
    assetTypes: {
      dashboards: {
        total: 125,
        listed: 125,
        enriched: 125,
        failed: 0,
        needsEnrichment: 0,
        phase: 'completed',
      },
      datasets: {
        total: 89,
        listed: 89,
        enriched: 89,
        failed: 0,
        needsEnrichment: 0,
        phase: 'completed',
      },
      analyses: {
        total: 234,
        listed: 234,
        enriched: 234,
        failed: 0,
        needsEnrichment: 0,
        phase: 'completed',
      },
      datasources: {
        total: 12,
        listed: 12,
        enriched: 12,
        failed: 0,
        needsEnrichment: 0,
        phase: 'completed',
      },
    },
  },
};

export const WithErrors: Story = {
  args: {
    assetTypes: {
      dashboards: {
        total: 125,
        listed: 125,
        enriched: 120,
        failed: 5,
        needsEnrichment: 0,
        phase: 'error',
      },
      datasets: {
        total: 89,
        listed: 89,
        enriched: 85,
        failed: 4,
        needsEnrichment: 0,
        phase: 'error',
      },
    },
  },
};

export const InProgress: Story = {
  args: {
    assetTypes: {
      dashboards: {
        total: 125,
        listed: 125,
        enriched: 50,
        failed: 0,
        needsEnrichment: 75,
        phase: 'enriching',
        currentBatch: 2,
        totalBatches: 5,
      },
      datasets: {
        total: 89,
        listed: 89,
        enriched: 30,
        failed: 0,
        needsEnrichment: 59,
        phase: 'enriching',
        currentBatch: 1,
        totalBatches: 3,
      },
      analyses: {
        total: 234,
        listed: 234,
        enriched: 100,
        failed: 2,
        needsEnrichment: 132,
        phase: 'enriching',
        currentBatch: 4,
        totalBatches: 8,
      },
    },
  },
};

export const JustStarted: Story = {
  args: {
    assetTypes: {
      dashboards: {
        total: 125,
        listed: 0,
        enriched: 0,
        failed: 0,
        needsEnrichment: 125,
        phase: 'listing',
      },
    },
  },
};

export const Empty: Story = {
  args: {
    assetTypes: {},
  },
};