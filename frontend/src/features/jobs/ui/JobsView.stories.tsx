import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { jobsRoutes, RUNNING_EXPORT_ID } from '../../../../.storybook/mocks/jobs';
import { JobsView } from './JobsView';

/**
 * Every job in one grid, filtered by type, status and window (all in the
 * URL), with a drawer that follows one job: status, phases, failures and its
 * log. The API is stubbed with a week of realistic jobs.
 */
const meta: Meta<typeof JobsView> = {
  title: 'Features/Jobs/JobsView',
  component: JobsView,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <MockedApi routes={jobsRoutes()}>
      <Box sx={{ p: 3 }}>
        <JobsView />
      </Box>
    </MockedApi>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LastWeek: Story = {
  name: 'The last 7 days',
  parameters: { router: { initialEntries: ['/operations?tab=jobs'] } },
};

export const Failed: Story = {
  name: 'Failed only, all time',
  parameters: { router: { initialEntries: ['/operations?tab=jobs&status=failed&since=all'] } },
};

export const RunningExportOpen: Story = {
  name: 'A running export, followed',
  parameters: {
    router: { initialEntries: [`/operations?tab=jobs&job=${RUNNING_EXPORT_ID}`] },
  },
};

export const BulkFailuresOpen: Story = {
  name: 'A bulk operation with item failures',
  parameters: { router: { initialEntries: ['/operations?tab=jobs&job=bulk-91de'] } },
};

export const PhasesOpen: Story = {
  name: 'An SMUS export with phases',
  parameters: { router: { initialEntries: ['/operations?tab=jobs&job=smus-2c91'] } },
};
