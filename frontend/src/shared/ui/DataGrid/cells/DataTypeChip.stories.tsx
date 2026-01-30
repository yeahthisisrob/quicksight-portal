import { Box, Stack, Typography } from '@mui/material';

import { DataTypeChip } from './DataTypeChip';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DataTypeChip> = {
  title: 'Shared/UI/DataGrid/Cells/DataTypeChip',
  component: DataTypeChip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A reusable cell component for displaying data type information. Supports single type, multiple type variants, and calculated field states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    dataType: {
      control: 'text',
      description: 'Primary data type to display',
    },
    variants: {
      control: 'object',
      description: 'Array of variants when field has different data types',
    },
    onVariantsClick: {
      action: 'variantsClicked',
      description: 'Callback when variants button is clicked',
    },
    isCalculated: {
      control: 'boolean',
      description: 'Whether to show as calculated field chip',
    },
    expressionVariantCount: {
      control: 'number',
      description: 'Number of expression variants for calculated fields',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dataType: 'STRING',
  },
};

export const StringType: Story = {
  args: {
    dataType: 'STRING',
  },
};

export const IntegerType: Story = {
  args: {
    dataType: 'INTEGER',
  },
};

export const DecimalType: Story = {
  args: {
    dataType: 'DECIMAL',
  },
};

export const DateTimeType: Story = {
  args: {
    dataType: 'DATETIME',
  },
};

export const UnknownType: Story = {
  args: {
    dataType: 'Unknown',
  },
};

export const NullType: Story = {
  args: {
    dataType: null,
  },
};

export const WithVariants: Story = {
  args: {
    dataType: 'STRING',
    variants: [
      { dataType: 'STRING', count: 3 },
      { dataType: 'INTEGER', count: 2 },
      { dataType: 'DECIMAL', count: 1 },
    ],
    onVariantsClick: () => alert('Show variants dialog'),
  },
};

export const CalculatedWithExpressionVariants: Story = {
  args: {
    dataType: 'Calculated',
    isCalculated: true,
    expressionVariantCount: 3,
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
    <Stack spacing={4} sx={{ minWidth: 400 }}>
      <StorySection title="Standard Data Types">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <DataTypeChip dataType="STRING" />
          <DataTypeChip dataType="INTEGER" />
          <DataTypeChip dataType="DECIMAL" />
          <DataTypeChip dataType="DATETIME" />
          <DataTypeChip dataType="BOOLEAN" />
        </Stack>
      </StorySection>

      <StorySection title="Empty / Unknown States">
        <Stack direction="row" spacing={2} alignItems="center">
          <Box>
            <Typography variant="caption" display="block">
              Unknown
            </Typography>
            <DataTypeChip dataType="Unknown" />
          </Box>
          <Box>
            <Typography variant="caption" display="block">
              Null
            </Typography>
            <DataTypeChip dataType={null} />
          </Box>
          <Box>
            <Typography variant="caption" display="block">
              Empty String
            </Typography>
            <DataTypeChip dataType="" />
          </Box>
        </Stack>
      </StorySection>

      <StorySection title="With Data Type Variants (hover for tooltip)">
        <DataTypeChip
          dataType="STRING"
          variants={[
            { dataType: 'STRING', count: 5 },
            { dataType: 'INTEGER', count: 3 },
            { dataType: 'DECIMAL', count: 2 },
          ]}
          onVariantsClick={() => alert('Show variants')}
        />
      </StorySection>

      <StorySection title="Calculated Field with Expression Variants">
        <DataTypeChip
          dataType="Calculated"
          isCalculated
          expressionVariantCount={4}
        />
      </StorySection>
    </Stack>
  ),
};
