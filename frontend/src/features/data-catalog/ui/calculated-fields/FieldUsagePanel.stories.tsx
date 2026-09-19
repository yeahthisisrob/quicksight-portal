import type { Meta, StoryObj } from '@storybook/react-vite';

import { CALCULATED_FIELD_DETAILS, heavyUsage, KEYS } from '../__stories__/fieldCatalog';
import { FieldUsagePanel } from './FieldUsagePanel';

const meta: Meta<typeof FieldUsagePanel> = {
  title: 'Features/Data Catalog/FieldUsagePanel',
  component: FieldUsagePanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Where a calculated field is used: one row per visual, plus a row for an asset that reads the field without a visual naming it. The type counts above are filters, and the grid virtualises, so a field in two hundred visuals costs the same as one in three.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 880 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FieldUsagePanel>;

const MARGIN = CALCULATED_FIELD_DETAILS[KEYS.margin];

export const AFewPlaces: Story = {
  name: 'three assets, three visuals',
  args: { usedIn: MARGIN?.usedIn ?? [], visuals: MARGIN?.visuals ?? [] },
};

export const Everywhere: Story = {
  name: 'two dozen assets, two hundred visuals',
  args: heavyUsage(),
};

export const Nowhere: Story = {
  name: 'nothing reads it',
  args: { usedIn: [], visuals: [] },
};
