import type { Meta, StoryObj } from '@storybook/react-vite';

import { FILTERS_QUESTION } from './__stories__/assistant';
import { QuestionCard } from './QuestionCard';

/**
 * A question the assistant asked (an AG-UI interrupt), answered by clicking.
 * Options that name a portal entity carry the graph's summary and a link.
 */
const meta: Meta<typeof QuestionCard> = {
  title: 'Features/Author/Assistant question',
  component: QuestionCard,
  parameters: { layout: 'padded' },
  args: { onAnswer: () => undefined },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const SeveralOrOther: Story = {
  name: 'Several filters, or something typed',
  args: { interrupt: FILTERS_QUESTION as never },
};

export const Answered: Story = {
  name: 'Answered: the choice stays, locked',
  args: {
    interrupt: FILTERS_QUESTION as never,
    answer: {
      interruptId: FILTERS_QUESTION.id,
      status: 'resolved',
      payload: { selected: ['order_date', 'region'], other: 'Sales channel' },
    },
  },
};
