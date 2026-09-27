import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { classifyExpression } from '@/shared/lib';

import { EvaluationOrder, FieldKindChip } from './FieldKind';

/** A field's kind and where QuickSight evaluates it, from the expression alone. */
const meta: Meta<typeof FieldKindChip> = {
  title: 'Entities/Field/Kind',
  component: FieldKindChip,
};

export default meta;
type Story = StoryObj<typeof meta>;

const EXAMPLES = [
  "ifelse({status} = 'C', {revenue} - {cost}, 0)",
  '{revenue} * ${fx_rate}',
  'sum({revenue}) / sum({cost})',
  'sum({revenue}, [{region}])',
  'sumOver({revenue}, [{region}], PRE_FILTER)',
  'runningSum(sum({revenue}), [{order_date} ASC])',
];

/** One of each kind; hover a chip for the stage and why. */
export const Kinds: Story = {
  args: { verdict: classifyExpression(EXAMPLES[0]!) },
  render: () => (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      {EXAMPLES.map((expression) => (
        <Stack key={expression} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <FieldKindChip verdict={classifyExpression(expression)} />
          <code>{expression}</code>
        </Stack>
      ))}
    </Stack>
  ),
};

/** The order of evaluation with a LAC-W PRE_FILTER field's stage marked. */
export const Order: Story = {
  args: { verdict: classifyExpression('sumOver({revenue}, [{region}], PRE_FILTER)') },
  render: (args) => <EvaluationOrder verdict={args.verdict} />,
};
