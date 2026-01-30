import { Box, Stack, Typography } from '@mui/material';

import { FieldNameCell } from './FieldNameCell';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FieldNameCell> = {
  title: 'Shared/UI/DataGrid/Cells/FieldNameCell',
  component: FieldNameCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A reusable cell component for displaying field names with optional icons. Shows calculated icon for calculated fields and warning icon for variants.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'text',
      description: 'The field name to display',
    },
    isCalculated: {
      control: 'boolean',
      description: 'Whether this is a calculated field',
    },
    hasVariants: {
      control: 'boolean',
      description: 'Whether this field has variants',
    },
    calculatedTooltip: {
      control: 'text',
      description: 'Custom tooltip for the calculated icon',
    },
    variantsTooltip: {
      control: 'text',
      description: 'Custom tooltip for the variants warning icon',
    },
    onClick: {
      action: 'clicked',
      description: 'Callback when the field name is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'customer_id',
  },
};

export const Clickable: Story = {
  args: {
    name: 'order_total',
    onClick: () => alert('Field name clicked!'),
  },
};

export const CalculatedField: Story = {
  args: {
    name: 'total_revenue',
    isCalculated: true,
    onClick: () => alert('Field clicked'),
  },
};

export const WithVariants: Story = {
  args: {
    name: 'product_price',
    hasVariants: true,
    onClick: () => alert('Field clicked'),
  },
};

export const CalculatedWithVariants: Story = {
  args: {
    name: 'profit_margin',
    isCalculated: true,
    hasVariants: true,
    onClick: () => alert('Field clicked'),
  },
};

export const CustomTooltips: Story = {
  args: {
    name: 'custom_metric',
    isCalculated: true,
    hasVariants: true,
    calculatedTooltip: 'This field is computed dynamically',
    variantsTooltip: 'Warning: Different formulas across 5 datasets',
    onClick: () => alert('Field clicked'),
  },
};

const StorySection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1, fontWeight: 500 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export const AllVariants: Story = {
  render: () => (
    <Stack spacing={4} sx={{ minWidth: 350 }}>
      <StorySection title="Regular Field">
        <FieldNameCell name="customer_name" />
      </StorySection>

      <StorySection title="Clickable Field">
        <FieldNameCell
          name="order_date"
          onClick={() => alert('Show field details')}
        />
      </StorySection>

      <StorySection title="Calculated Field">
        <FieldNameCell
          name="total_revenue"
          isCalculated
          onClick={() => alert('Show calculated field')}
        />
      </StorySection>

      <StorySection title="Field with Variants (hover warning icon)">
        <FieldNameCell
          name="product_price"
          hasVariants
          onClick={() => alert('Show variants')}
        />
      </StorySection>

      <StorySection title="Calculated Field with Variants">
        <FieldNameCell
          name="profit_margin"
          isCalculated
          hasVariants
          onClick={() => alert('Show details')}
        />
      </StorySection>

      <StorySection title="Long Field Names">
        <Stack spacing={1}>
          <FieldNameCell
            name="very_long_field_name_that_might_overflow"
            onClick={() => alert('Clicked')}
          />
          <FieldNameCell
            name="calculated_long_field_name_example"
            isCalculated
            hasVariants
            onClick={() => alert('Clicked')}
          />
        </Stack>
      </StorySection>
    </Stack>
  ),
};
