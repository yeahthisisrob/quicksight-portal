import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EXPORT_LOG } from '../../../../.storybook/mocks/jobs';
import { JobLogGrid } from './JobLogGrid';

/**
 * A job's log as data: filter by level (debug hidden until asked for), filter
 * by message or asset, click a line for its details. While a job runs the
 * newest line stays in view.
 */
const meta: Meta<typeof JobLogGrid> = {
  title: 'Entities/Job/JobLogGrid',
  component: JobLogGrid,
  decorators: [
    (Story) => (
      <Box sx={{ p: 3, maxWidth: 1100 }}>
        <Story />
      </Box>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Finished: Story = { args: { logs: EXPORT_LOG } };

export const Following: Story = {
  name: 'Following a running job',
  args: { logs: EXPORT_LOG, follow: true, height: 320 },
};

export const Empty: Story = { args: { logs: [], follow: true } };

export const Unreadable: Story = {
  name: 'Log could not be read',
  args: { logs: [], error: 'Could not load the log: 503 Service Unavailable' },
};
