import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { TimelineFilters } from '../hooks/useActivityTimeline';
import { type TimelineDateRange, TimelineFilterBar } from './TimelineFilterBar';

const meta: Meta<typeof TimelineFilterBar> = {
  title: 'Features/Activity/TimelineFilterBar',
  component: TimelineFilterBar,
  parameters: {
    docs: {
      description: {
        component:
          'Window, resource type, action, origin, and the one-click "Made by agents". The per-asset page hides the resource type.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ width: 1100, bgcolor: 'background.paper' }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TimelineFilterBar>;

function Wrapper({
  hideResourceTypes = false,
  initial = {},
}: {
  hideResourceTypes?: boolean;
  initial?: TimelineFilters;
}) {
  const [filters, setFilters] = useState<TimelineFilters>(initial);
  const [dateRange, setDateRange] = useState<TimelineDateRange>('30d');
  const [showIngestions, setShowIngestions] = useState(false);
  return (
    <TimelineFilterBar
      filters={filters}
      onChange={setFilters}
      hideResourceTypes={hideResourceTypes}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      showIngestions={showIngestions}
      onShowIngestionsChange={setShowIngestions}
    />
  );
}

export const Default: Story = {
  render: () => <Wrapper />,
};

export const AgentsOnly: Story = {
  render: () => <Wrapper initial={{ origins: ['portal-api'] }} />,
};

export const PerAsset: Story = {
  render: () => <Wrapper hideResourceTypes />,
};
