import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ArchivedAssetItem } from '@/features/asset-management';

import { type MockRoute, useMockApi } from '../../../.storybook/mocks/api';
import { RestoreAssetDialog } from './RestoreAssetDialog';

/**
 * On open the dialog reads the archived export
 * (GET /assets/archive/{type}/{id}/metadata) and validates the restore
 * (POST /deployments/validate); each story stubs both.
 */
const archivedExport = {
  apiResponses: {
    describe: {
      data: {
        Name: 'Sales Dataset 2024',
        Description: 'Orders joined to customers, refreshed nightly',
        ImportMode: 'SPICE',
        RowInfo: { RowCount: 1_500_000 },
        ConsumedSpiceCapacityInBytes: 256 * 1024 * 1024,
      },
    },
    permissions: {
      data: [
        {
          Principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Analysts',
          Actions: ['quicksight:DescribeDataSet', 'quicksight:PassDataSet'],
        },
      ],
    },
    refreshSchedules: {
      data: [
        {
          ScheduleId: 'nightly',
          ScheduleFrequency: { Interval: 'DAILY', TimeOfTheDay: '02:00' },
          RefreshType: 'FULL_REFRESH',
        },
      ],
    },
  },
};

const routes: MockRoute[] = [
  {
    method: 'get',
    url: /^\/assets\/archive\/.+\/metadata$/,
    respond: () => ({ body: { success: true, data: archivedExport } }),
  },
  {
    method: 'post',
    url: '/deployments/validate',
    respond: () => ({
      body: {
        success: true,
        data: {
          canDeploy: true,
          validationResults: [
            {
              validator: 'dependencies',
              passed: true,
              message: 'Data source found',
              severity: 'info',
            },
          ],
        },
      },
    }),
  },
];

function Stubbed({ children }: { children: React.ReactNode }) {
  // Installed during render: the dialog's effects request on mount.
  useMockApi(routes);
  return <>{children}</>;
}

const dataset: ArchivedAssetItem = {
  id: 'dataset-123',
  name: 'Sales Dataset 2024',
  type: 'dataset',
  createdTime: '2024-01-15T10:30:00Z',
  lastUpdatedTime: '2024-06-01T00:00:00Z',
  lastExportTime: '2024-06-01T00:00:00Z',
  enrichmentStatus: 'enriched',
  permissions: [],
  archivedDate: '2024-07-01T09:00:00Z',
  archivedBy: 'admin@example.com',
  archiveReason: 'Replaced with updated version',
  size: 256 * 1024 * 1024,
  status: 'archived',
  tags: [
    { key: 'Department', value: 'Sales' },
    { key: 'Year', value: '2024' },
  ],
};

const meta = {
  title: 'Widgets/RestoreAssetDialog',
  component: RestoreAssetDialog,
  parameters: { layout: 'centered' },
  args: { open: true, onClose: () => {}, onSuccess: () => {}, asset: dataset },
  decorators: [
    (Story) => (
      <Stubbed>
        <Story />
      </Stubbed>
    ),
  ],
} satisfies Meta<typeof RestoreAssetDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A SPICE dataset with a refresh schedule; validation passes, so it can be
 * restored. (A failed validation re-validates every 100ms in
 * useRestoreDialog, so it has no story until that settles.)
 */
export const Dataset: Story = {};
