import type { Meta, StoryObj } from '@storybook/react-vite';

import { Markdown } from './Markdown';

/** What a model writes, drawn as text: bold, lists, code, a short table and links. */
const meta = {
  title: 'Shared/Markdown',
  component: Markdown,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssistantQuestion: Story = {
  name: 'An assistant answer that asks a question',
  args: {
    children: [
      'I found **two** datasets over `orders_gold`:',
      '',
      '1. **Orders (gold)** (`ds-orders-gold`), SPICE, used by 4 dashboards',
      '2. **Orders gold (direct)** (`ds-orders-direct`), direct query',
      '',
      '| Dataset | Mode | Rows |',
      '|---|---|---|',
      '| Orders (gold) | SPICE | 1.2M |',
      '| Orders gold (direct) | Direct | - |',
      '',
      'Which one should the analysis read? The draft is in [Author](/author?type=analysis).',
    ].join('\n'),
  },
};
