import type { Meta, StoryObj } from '@storybook/react-vite';

import { FIELD_VERDICTS } from './__stories__/assistant';
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

export const PushDownStrategy: Story = {
  name: 'Push down to the source: reuse, follow-up, analysis',
  args: { fields: FIELD_VERDICTS.fields as never },
};

export const DatasetStrategy: Story = {
  name: 'Materialise in the dataset',
  args: {
    fields: [
      {
        name: 'Unit price',
        expression: '{revenue} / {qty}',
        verdict: 'dataset',
        note: 'Row-level: per your guidance it belongs in the QuickSight dataset, computed once there rather than in every analysis.',
      },
    ],
  },
};

export const NoPreference: Story = {
  name: 'No stated strategy',
  args: {
    fields: [
      {
        name: 'Unit price',
        expression: '{revenue} / {qty}',
        verdict: 'row-level',
        note: 'Row-level, so it could be materialised in the dataset or upstream; your guidance states no preference.',
      },
    ],
  },
};
