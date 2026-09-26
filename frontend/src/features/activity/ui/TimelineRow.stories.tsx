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

/** One row per kind of actor: agent via the API, person via the portal UI, portal without provenance, console role, console user, automation. */
export const ActorKinds: Story = {
  render: () => {
    const byOrigin = (origin: string) => TIMELINE_EVENTS.find((e) => e.origin === origin);
    const events = [
      byOrigin('portal-api'),
      byOrigin('portal-ui'),
      byOrigin('portal'),
      TIMELINE_EVENTS.find((e) => e.actor.kind === 'role'),
      TIMELINE_EVENTS.find((e) => e.actor.kind === 'user' && e.action === 'grant'),
      byOrigin('automation'),
    ].filter((e) => e !== undefined);
    return (
      <>
        {events.map((event) => (
          <TimelineRow key={event.id} event={event} connect={false} />
        ))}
      </>
    );
  },
};

export const Burst: Story = {
  name: 'Burst (3 events, click to open)',
  render: () => {
    const [day] = groupTimeline(TIMELINE_EVENTS.slice(0, 3));
    return <TimelineGroupRow group={day!.groups[0]!} connect={false} />;
  },
};
