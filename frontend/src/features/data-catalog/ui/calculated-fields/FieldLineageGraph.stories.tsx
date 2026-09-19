import type { Meta, StoryObj } from '@storybook/react-vite';

import { CALCULATED_FIELD_DETAILS, KEYS, WIDE_CHAIN } from '../__stories__/fieldCatalog';
import { FieldLineageGraph } from './FieldLineageGraph';

const meta: Meta<typeof FieldLineageGraph> = {
  title: 'Features/Data Catalog/FieldLineageGraph',
  component: FieldLineageGraph,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "A calculated field's dependency chain: the columns it is ultimately computed from on the left, the field in the middle, everything computed from it on the right. Every calculated node opens that field, so the chain is walked rather than read.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FieldLineageGraph>;

export const OneHopEachWay: Story = {
  name: 'margin: two columns in, two fields out',
  args: {
    lineage: CALCULATED_FIELD_DETAILS[KEYS.margin]?.lineage,
    focusKey: KEYS.margin,
    onOpenField: () => {},
  },
};

export const WideAndDeep: Story = {
  name: 'six columns, two intermediates, three consumers, truncated',
  args: { lineage: WIDE_CHAIN, focusKey: KEYS.margin, onOpenField: () => {} },
};

export const Standalone: Story = {
  name: 'a field nothing else touches',
  args: {
    lineage: {
      nodes: [{ id: 'cf:only', name: 'only', kind: 'calculated', depth: 0 }],
      edges: [],
      truncated: false,
    },
    focusKey: 'only',
    onOpenField: () => {},
  },
};
