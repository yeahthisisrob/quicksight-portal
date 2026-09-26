import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { type ChipType, chipConfig } from './chipConfig';
import TypedChip from './index';

const CHIP_TYPES = Object.keys(chipConfig) as ChipType[];

const meta = {
  title: 'Shared/UI/TypedChip',
  component: TypedChip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A universal chip for types (assets, fields, filters, tags, relationships, etc.) with consistent styling. Used for asset indicators, JSON viewer highlights, tags and relationships.',
      },
    },
  },
  argTypes: {
    type: { control: 'select', options: CHIP_TYPES },
    size: { control: 'select', options: ['small', 'medium'] },
    variant: { control: 'select', options: ['filled', 'outlined'] },
  },
  args: {
    type: 'DASHBOARD',
    showIcon: true,
    size: 'small',
    variant: 'filled',
  },
} satisfies Meta<typeof TypedChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every type from the config, then the modifiers: outlined, active, count, no icon, custom label, medium. */
export const TypesAndModifiers: Story = {
  render: () => (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
        {CHIP_TYPES.map((type) => (
          <TypedChip key={type} type={type} />
        ))}
      </Stack>
      <Stack sx={{ flexWrap: 'wrap', alignItems: 'center' }} direction="row" spacing={1} useFlexGap>
        <TypedChip type="FIELDS" variant="outlined" />
        <TypedChip type="CALCULATED_FIELDS" variant="outlined" isActive />
        <TypedChip type="DATASET" count={23} />
        <TypedChip type="RELATIONSHIP" count={0} />
        <TypedChip type="RELATIONSHIP" count={999} />
        <TypedChip type="TAG" customLabel="Department:HR" variant="outlined" />
        <TypedChip type="TAG" customLabel="+5" showIcon={false} />
        <TypedChip type="ANALYSIS" size="medium" />
      </Stack>
    </Stack>
  ),
};
