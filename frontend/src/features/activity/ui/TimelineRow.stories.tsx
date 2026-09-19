import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { groupTimeline } from '../lib/timelineGroups';
import { TIMELINE_EVENTS } from './__stories__/fixtures';
import { TimelineGroupRow, TimelineRow } from './TimelineRow';

const meta: Meta<typeof TimelineRow> = {
  title: 'Features/Activity/TimelineRow',
  component: TimelineRow,
  parameters: {
    docs: {
      description: {
        component:
          'One event as a sentence: who (Portal with the person or API key behind it, a role and person, a user, a service), did what, to which asset, from where, when. Bursts collapse to one row.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box
        sx={(theme) => ({
          width: 880,
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
        })}
      >
        <Story />
      </Box>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TimelineRow>;

const byOrigin = (origin: string, fallback = 0) =>
  TIMELINE_EVENTS.find((e) => e.origin === origin) ?? TIMELINE_EVENTS[fallback]!;

export const AgentThroughTheApi: Story = {
  args: { event: byOrigin('portal-api'), connect: false },
};

export const PersonThroughThePortal: Story = {
  args: { event: byOrigin('portal-ui'), connect: false },
};

export const PortalWithoutProvenance: Story = {
  args: { event: byOrigin('portal'), connect: false },
};

export const ConsoleRole: Story = {
  args: {
    event: TIMELINE_EVENTS.find((e) => e.actor.kind === 'role')!,
    connect: false,
  },
};

export const ConsoleUser: Story = {
  args: {
    event: TIMELINE_EVENTS.find((e) => e.actor.kind === 'user' && e.action === 'grant')!,
    connect: false,
  },
};

export const Automation: Story = {
  args: { event: byOrigin('automation'), connect: false },
};

export const Burst: Story = {
  name: 'Burst (3 events, click to open)',
  render: () => {
    const [day] = groupTimeline(TIMELINE_EVENTS.slice(0, 3));
    return <TimelineGroupRow group={day!.groups[0]!} connect={false} />;
  },
};
