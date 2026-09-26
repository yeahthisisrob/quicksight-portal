import { Link } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { KeyValuePairs } from './KeyValuePairs';
import { StatusIndicator } from './StatusIndicator';

const meta: Meta<typeof KeyValuePairs> = {
  title: 'Design System/KeyValuePairs',
  component: KeyValuePairs,
  parameters: {
    docs: {
      description: {
        component:
          'Labelled facts in a grid. The label is small and secondary, the value is body text, so a scan finds the values.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoColumns: Story = {
  args: {
    items: [
      { label: 'Dataset id', value: <code>orders-gold</code> },
      { label: 'Import mode', value: 'DIRECT_QUERY', info: 'Queries run against the source.' },
      { label: 'Owner', value: <Link href="#">analytics-team</Link> },
      { label: 'Status', value: <StatusIndicator type="success">Available</StatusIndicator> },
      { label: 'Description', value: '' },
    ],
  },
};
