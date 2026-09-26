import type { Meta, StoryObj } from '@storybook/react-vite';

import { AwsParity, PARITY_ROWS } from './AwsParity';

/** The portal beside AWS, one capability a row, with how far AWS has got. */
const meta: Meta<typeof AwsParity> = {
  title: 'Features/AWS parity',
  component: AwsParity,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One of each AWS status: not in AWS, announced, partly. */
export const Statuses: Story = {
  args: {
    rows: ['none', 'announced', 'partial'].map(
      (status) => PARITY_ROWS.find((r) => r.status === status)!
    ),
  },
};
