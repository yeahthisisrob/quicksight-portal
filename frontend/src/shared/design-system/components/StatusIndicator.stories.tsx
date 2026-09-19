import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusIndicator, type StatusType } from './StatusIndicator';

const meta: Meta<typeof StatusIndicator> = {
  title: 'Design System/StatusIndicator',
  component: StatusIndicator,
  parameters: {
    docs: {
      description: {
        component:
          'Icon plus text for a state. Colour carries the meaning and the icon carries it for anyone who cannot see colour, so never pass one without the other.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const ALL: Array<[StatusType, string]> = [
  ['success', 'Succeeded'],
  ['error', '3 errors'],
  ['warning', 'Needs a decision'],
  ['info', 'Proposed'],
  ['pending', 'Waiting for approval'],
  ['in-progress', 'Exporting'],
  ['loading', 'Loading'],
  ['stopped', 'Stopped'],
];

export const AllTypes: Story = {
  render: () => (
    <Stack spacing={1.5}>
      {ALL.map(([type, label]) => (
        <StatusIndicator key={type} type={type}>
          {label}
        </StatusIndicator>
      ))}
    </Stack>
  ),
};

export const Small: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      {ALL.slice(0, 4).map(([type, label]) => (
        <StatusIndicator key={type} type={type} size="small">
          {label}
        </StatusIndicator>
      ))}
    </Stack>
  ),
};

export const IconOnly: Story = {
  args: { type: 'success', iconOnly: true, children: 'Succeeded' },
};
