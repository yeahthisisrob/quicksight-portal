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

export const ThreeColumns: Story = {
  args: {
    columns: 3,
    items: [
      { label: 'Visuals', value: '12' },
      { label: 'Sheets', value: '3' },
      { label: 'Datasets', value: '2' },
      { label: 'Parameters', value: '1' },
      { label: 'Filters', value: '4' },
      { label: 'Calculated fields', value: '7' },
    ],
  },
};
