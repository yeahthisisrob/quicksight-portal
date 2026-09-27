import type { Meta, StoryObj } from '@storybook/react-vite';

import { ColorSwatches } from '.';

/** A theme's colors, in a table cell or a preview. */
const meta: Meta<typeof ColorSwatches> = {
  title: 'Shared/Color swatches',
  component: ColorSwatches,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const DataColors: Story = {
  args: { colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B'] },
};

export const InterfaceRoles: Story = {
  args: {
    size: 24,
    colors: [
      { color: '#FFFFFF', label: 'PrimaryBackground' },
      { color: '#1B1B1B', label: 'PrimaryForeground' },
      { color: '#0B6E4F', label: 'Accent' },
    ],
  },
};

export const ManyColors: Story = {
  args: {
    colors: Array.from({ length: 20 }, (_, i) => `hsl(${i * 18}, 65%, 50%)`),
  },
};

export const Empty: Story = { args: { colors: [] } };
