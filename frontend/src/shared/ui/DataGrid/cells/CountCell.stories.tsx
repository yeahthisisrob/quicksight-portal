import { Box, Stack, Typography } from '@mui/material';

import { CountCell } from './CountCell';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CountCell> = {
  title: 'Shared/UI/DataGrid/Cells/CountCell',
  component: CountCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A reusable cell component for displaying numeric counts in DataGrid. Shows enabled styling when count > 0, disabled styling otherwise. Supports tooltips and click handlers.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'number',
      description: 'The numeric value to display',
    },
    tooltipContent: {
      control: 'text',
      description: 'Optional tooltip content shown on hover',
    },
    onClick: {
      action: 'clicked',
      description: 'Callback when the count is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 5,
  },
};

export const ZeroCount: Story = {
  args: {
    value: 0,
  },
};

export const HighCount: Story = {
  args: {
    value: 1234,
  },
};

export const WithTooltip: Story = {
  args: {
    value: 42,
    tooltipContent: (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          Total Usage: 42
        </Typography>
        <Typography variant="caption" display="block">
          Count of actual usage in:
        </Typography>
        <Typography variant="caption" display="block">
          Visuals (charts, tables, etc.)
        </Typography>
        <Typography variant="caption" display="block">
          Calculated field expressions
        </Typography>
      </Box>
    ),
  },
};

export const Clickable: Story = {
  args: {
    value: 15,
    onClick: () => alert('Count clicked!'),
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
    <Stack spacing={3} sx={{ minWidth: 300 }}>
      <StorySection title="Count States">
        <Stack direction="row" spacing={3} alignItems="center">
          <Box>
            <Typography variant="caption" display="block">
              Zero
            </Typography>
            <CountCell value={0} />
          </Box>
          <Box>
            <Typography variant="caption" display="block">
              Low
            </Typography>
            <CountCell value={5} />
          </Box>
          <Box>
            <Typography variant="caption" display="block">
              High
            </Typography>
            <CountCell value={1234} />
          </Box>
        </Stack>
      </StorySection>

      <StorySection title="With Tooltip">
        <CountCell
          value={42}
          tooltipContent={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Visual Usage: 42
              </Typography>
              <Typography variant="caption">
                Hover to see this tooltip
              </Typography>
            </Box>
          }
        />
      </StorySection>

      <StorySection title="Clickable">
        <CountCell value={15} onClick={() => alert('Clicked!')} />
      </StorySection>
    </Stack>
  ),
};
