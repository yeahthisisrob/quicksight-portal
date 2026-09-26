import type { Meta, StoryObj } from '@storybook/react-vite';

import { FieldVerdicts } from './FieldVerdicts';

/**
 * The calculated fields a plan adds, each placed by the organisation's
 * field strategy, with the ones that belong elsewhere listed as follow-ups.
 */
const meta: Meta<typeof FieldVerdicts> = {
  title: 'Features/Author/Assistant field verdicts',
  component: FieldVerdicts,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The push-down strategy (reuse a column, follow-up upstream, keep in the
 * analysis) is drawn inside the assistant chat's Planned story; these are the
 * other two strategies' verdicts.
 */
export const DatasetOrNoPreference: Story = {
  name: 'Materialise in the dataset, or no stated strategy',
  args: {
    fields: [
      {
        name: 'Unit price',
        expression: '{revenue} / {qty}',
        verdict: 'dataset',
        note: 'Row-level: per your guidance it belongs in the QuickSight dataset, computed once there rather than in every analysis.',
      },
      {
        name: 'Unit margin',
        expression: '({revenue} - {cost}) / {qty}',
        verdict: 'row-level',
        note: 'Row-level, so it could be materialised in the dataset or upstream; your guidance states no preference.',
      },
    ],
  },
};
