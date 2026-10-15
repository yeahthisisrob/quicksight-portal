import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatStrip } from './StatStrip';
import { StatusIndicator } from './StatusIndicator';

/**
 * The one strip of counts for every summary: label over number, tiles with
 * dividers, hints under the numbers. Numbers only, never controls.
 */
const meta: Meta<typeof StatStrip> = {
  title: 'Design System/StatStrip',
  component: StatStrip,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { label: 'Cached assets', value: '1,250' },
      { label: 'Archived', value: '45' },
      { label: 'Fields', value: '3,456', hint: '789 calculated' },
      {
        label: 'Last export',
        value: '30 minutes ago',
        hint: (
          <StatusIndicator type="success" size="small">
            Oct 15, 2026 09:30
          </StatusIndicator>
        ),
      },
    ],
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    items: [
      { label: 'Cached assets', value: 0 },
      { label: 'Archived', value: 0 },
      { label: 'Fields', value: 0 },
      { label: 'Last export', value: '' },
    ],
  },
};
