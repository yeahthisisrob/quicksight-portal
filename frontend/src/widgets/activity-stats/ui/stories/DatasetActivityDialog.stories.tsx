import { Dialog, DialogContent, DialogTitle } from '@mui/material';

import { DatasetActivityContent } from '../DatasetActivityContent';

import type { DatasetActivityData } from '@/shared/api/modules/activity';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DatasetActivityContent> = {
  title: 'Widgets/ActivityStats/DatasetActivityDialog',
  component: DatasetActivityContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Activity view for a dataset: refresh (ingestion) history plus aggregated view/update activity of the dashboards and analyses that use it. The DatasetActivityDialog widget fetches from GET /activity/dataset/{id} and renders this content.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Dialog open maxWidth="lg" fullWidth hideBackdrop disablePortal>
        <DialogTitle>Activity - Sales Transactions</DialogTitle>
        <DialogContent>
          <Story />
        </DialogContent>
      </Dialog>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const baseIngestion = {
  datasetId: 'dataset-001',
  datasetName: 'Sales Transactions',
  importMode: 'SPICE' as const,
  datasourceType: 'REDSHIFT',
  sizeInBytes: 1024 * 1024 * 512,
};

const mockActivity: DatasetActivityData = {
  datasetId: 'dataset-001',
  datasetName: 'Sales Transactions',
  totalViews: 842,
  uniqueViewers: 37,
  lastViewed: '2026-08-16T15:30:00Z',
  viewsByDate: {
    '2026-08-16': 64,
    '2026-08-15': 112,
    '2026-08-14': 87,
    '2026-08-13': 140,
    '2026-08-12': 95,
    '2026-08-11': 121,
    '2026-08-10': 78,
  },
  usedBy: [
    {
      assetId: 'dashboard-001',
      assetName: 'Executive Sales Dashboard',
      assetType: 'dashboard',
      totalViews: 610,
      uniqueViewers: 31,
      lastViewed: '2026-08-16T15:30:00Z',
      lastUpdated: '2026-08-12T09:14:00Z',
    },
    {
      assetId: 'analysis-001',
      assetName: 'Regional Sales Deep Dive',
      assetType: 'analysis',
      totalViews: 232,
      uniqueViewers: 8,
      lastViewed: '2026-08-15T11:02:00Z',
      lastUpdated: '2026-08-15T11:45:00Z',
    },
    {
      assetId: 'dashboard-002',
      assetName: 'Ops Monitoring',
      assetType: 'dashboard',
      totalViews: 0,
      uniqueViewers: 0,
      lastViewed: null,
      lastUpdated: null,
    },
  ],
  refreshSummary: {
    totalIngestions: 96,
    failedIngestions: 2,
    lastIngestionTime: '2026-08-17T06:00:00Z',
    lastIngestionStatus: 'COMPLETED',
  },
  ingestions: [
    {
      ...baseIngestion,
      id: 'ing-001',
      status: 'COMPLETED',
      createdTime: '2026-08-17T06:00:00Z',
      ingestionTimeInSeconds: 312,
      rowsIngested: 1250000,
      rowsDropped: 0,
      requestType: 'FULL_REFRESH',
    },
    {
      ...baseIngestion,
      id: 'ing-002',
      status: 'FAILED',
      createdTime: '2026-08-16T06:00:00Z',
      ingestionTimeInSeconds: 45,
      errorType: 'DATA_SOURCE_CONNECTION_FAILED',
      errorMessage: 'Could not connect to the data source',
      requestType: 'FULL_REFRESH',
    },
    {
      ...baseIngestion,
      id: 'ing-003',
      status: 'COMPLETED',
      createdTime: '2026-08-15T06:00:00Z',
      ingestionTimeInSeconds: 4021,
      rowsIngested: 1248311,
      rowsDropped: 12,
      requestType: 'INCREMENTAL_REFRESH',
    },
  ],
};

const mockDirectQueryActivity: DatasetActivityData = {
  ...mockActivity,
  datasetId: 'dataset-002',
  datasetName: 'Live Orders (Direct Query)',
  refreshSummary: {
    totalIngestions: 0,
    failedIngestions: 0,
    lastIngestionTime: null,
    lastIngestionStatus: null,
  },
  ingestions: [],
};

const mockUnusedActivity: DatasetActivityData = {
  datasetId: 'dataset-003',
  datasetName: 'Staging Import',
  totalViews: 0,
  uniqueViewers: 0,
  lastViewed: null,
  viewsByDate: {},
  usedBy: [],
  refreshSummary: {
    totalIngestions: 4,
    failedIngestions: 4,
    lastIngestionTime: '2026-08-14T06:00:00Z',
    lastIngestionStatus: 'FAILED',
  },
  ingestions: [
    {
      ...baseIngestion,
      id: 'ing-010',
      datasetId: 'dataset-003',
      datasetName: 'Staging Import',
      status: 'FAILED',
      createdTime: '2026-08-14T06:00:00Z',
      ingestionTimeInSeconds: 10,
      errorType: 'PERMISSION_DENIED',
      errorMessage: 'Access denied to underlying table',
      requestType: 'FULL_REFRESH',
    },
  ],
};

export const Default: Story = {
  args: { activity: mockActivity },
};

export const DirectQueryDataset: Story = {
  args: { activity: mockDirectQueryActivity },
};

export const UnusedWithFailedRefreshes: Story = {
  args: { activity: mockUnusedActivity },
};
