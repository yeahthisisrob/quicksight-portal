import { Box } from '@mui/material';
import { useState } from 'react';

import { TimelineFilterBar, type TimelineDateRange } from './TimelineFilterBar';

import type { TimelineFilters } from '../hooks/useActivityTimeline';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TimelineFilterBar> = {
  title: 'Features/Activity/TimelineFilterBar',
  component: TimelineFilterBar,
  decorators: [
    (Story) => (
      <Box sx={{ width: 960, bgcolor: 'background.paper' }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TimelineFilterBar>;

/** Stateful wrapper so the filter controls are interactive in Storybook. */
function Wrapper({ hideResourceTypes = false }: { hideResourceTypes?: boolean }) {
  const [filters, setFilters] = useState<TimelineFilters>({});
  const [dateRange, setDateRange] = useState<TimelineDateRange>('30d');
  return (
    <TimelineFilterBar
      filters={filters}
      onChange={setFilters}
      hideResourceTypes={hideResourceTypes}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
    />
  );
}

export const Default: Story = {
  render: () => <Wrapper />,
};

export const PerAssetPinned: Story = {
  render: () => <Wrapper hideResourceTypes />,
};
