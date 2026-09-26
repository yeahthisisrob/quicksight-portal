import type { Meta, StoryObj } from '@storybook/react-vite';

import { AwsParity, PARITY_ROWS } from './AwsParity';

/** The portal and AWS side by side, gaps on both sides. */
const meta: Meta<typeof AwsParity> = {
  title: 'Features/AWS parity',
  component: AwsParity,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Narrow: the capability spans the row, the two sides sit under it. */
export const Narrow: Story = {
  args: { rows: PARITY_ROWS.slice(0, 4) },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
