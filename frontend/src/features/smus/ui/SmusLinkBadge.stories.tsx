import { Box, Typography } from '@mui/material';

import { SmusLinkBadge } from './SmusLinkBadge';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SmusLinkBadge> = {
  title: 'Features/Smus/SmusLinkBadge',
  component: SmusLinkBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Positive-only indicator that a QuickSight dataset has a matching catalog item in the configured SMUS (SageMaker Unified Studio) domain. Rendered beside the dataset name in the asset table; unlinked datasets render nothing.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LinkedByName: Story = {
  args: {
    link: {
      datasetId: 'dataset-001',
      linked: true,
      matchType: 'name',
      listingId: 'listing-abc123',
      listingName: 'Sales Transactions',
      url: 'https://dzd_example.sagemaker.us-east-1.on.aws/catalog/assets/listing-abc123',
    },
  },
};

export const LinkedBySourceTable: Story = {
  args: {
    link: {
      datasetId: 'dataset-002',
      linked: true,
      matchType: 'source-table',
      listingId: 'listing-def456',
      listingName: 'analytics.sales_orders',
      url: 'https://dzd_example.sagemaker.us-east-1.on.aws/catalog/assets/listing-def456',
    },
  },
};

export const InTableContext: Story = {
  render: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="body2">Sales Transactions</Typography>
      <SmusLinkBadge
        link={{
          datasetId: 'dataset-001',
          linked: true,
          matchType: 'name',
          listingId: 'listing-abc123',
          listingName: 'Sales Transactions',
        }}
      />
    </Box>
  ),
};

export const NotLinkedRendersNothing: Story = {
  args: {
    link: { datasetId: 'dataset-003', linked: false },
  },
};
