import { Box, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SmusLinkBadge } from './SmusLinkBadge';

const meta: Meta<typeof SmusLinkBadge> = {
  title: 'Features/SMUS/SmusLinkBadge',
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
