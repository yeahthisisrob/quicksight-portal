import { Box, Paper, Stack, Typography } from '@mui/material';

import { ActionButtonsCell, ActionButton } from './ActionButtonsCell';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ActionButtonsCell> = {
  title: 'Shared/UI/DataGrid/Cells/ActionButtonsCell',
  component: ActionButtonsCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A reusable cell component for displaying action buttons in DataGrid. Supports common action icons (info, edit, delete, code) with optional tooltips.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    actions: {
      control: 'object',
      description: 'Array of action buttons to render',
    },
    size: {
      control: 'select',
      options: ['small', 'medium'],
      description: 'Button size',
    },
    gap: {
      control: 'number',
      description: 'Gap between buttons',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const defaultActions: ActionButton[] = [
  { icon: 'info', onClick: () => alert('Info clicked'), tooltip: 'View details' },
];

export const Default: Story = {
  args: {
    actions: defaultActions,
  },
};

export const InfoOnly: Story = {
  args: {
    actions: [
      { icon: 'info', onClick: () => alert('Info'), tooltip: 'View details' },
    ],
  },
};

export const EditAndDelete: Story = {
  args: {
    actions: [
      { icon: 'edit', onClick: () => alert('Edit'), tooltip: 'Edit item' },
      {
        icon: 'delete',
        onClick: () => alert('Delete'),
        tooltip: 'Delete item',
        color: 'error',
      },
    ],
  },
};

export const CodeAndInfo: Story = {
  args: {
    actions: [
      {
        icon: 'code',
        onClick: () => alert('View code'),
        tooltip: 'View expression',
      },
      {
        icon: 'info',
        onClick: () => alert('Info'),
        tooltip: 'View details',
      },
    ],
  },
};

export const AllActions: Story = {
  args: {
    actions: [
      { icon: 'code', onClick: () => alert('Code'), tooltip: 'View code' },
      { icon: 'info', onClick: () => alert('Info'), tooltip: 'View details' },
      { icon: 'edit', onClick: () => alert('Edit'), tooltip: 'Edit' },
      {
        icon: 'delete',
        onClick: () => alert('Delete'),
        tooltip: 'Delete',
        color: 'error',
      },
    ],
  },
};

export const WithoutTooltips: Story = {
  args: {
    actions: [
      { icon: 'edit', onClick: () => alert('Edit') },
      { icon: 'delete', onClick: () => alert('Delete'), color: 'error' },
    ],
  },
};

export const MediumSize: Story = {
  args: {
    actions: [
      { icon: 'info', onClick: () => alert('Info'), tooltip: 'View details' },
      { icon: 'edit', onClick: () => alert('Edit'), tooltip: 'Edit' },
    ],
    size: 'medium',
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
      <StorySection title="Single Action">
        <ActionButtonsCell
          actions={[
            {
              icon: 'info',
              onClick: () => alert('Info'),
              tooltip: 'View details',
            },
          ]}
        />
      </StorySection>

      <StorySection title="Edit & Delete (common pattern)">
        <ActionButtonsCell
          actions={[
            { icon: 'edit', onClick: () => alert('Edit'), tooltip: 'Edit' },
            {
              icon: 'delete',
              onClick: () => alert('Delete'),
              tooltip: 'Delete',
              color: 'error',
            },
          ]}
        />
      </StorySection>

      <StorySection title="Code & Info (calculated fields)">
        <ActionButtonsCell
          actions={[
            {
              icon: 'code',
              onClick: () => alert('Code'),
              tooltip: 'View expression',
            },
            {
              icon: 'info',
              onClick: () => alert('Info'),
              tooltip: 'View details',
            },
          ]}
        />
      </StorySection>

      <StorySection title="All Action Types">
        <ActionButtonsCell
          actions={[
            { icon: 'code', onClick: () => alert('Code') },
            { icon: 'info', onClick: () => alert('Info'), color: 'primary' },
            { icon: 'edit', onClick: () => alert('Edit') },
            { icon: 'delete', onClick: () => alert('Delete'), color: 'error' },
          ]}
        />
      </StorySection>

      <StorySection title="Size Comparison">
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
              Small
            </Typography>
            <ActionButtonsCell
              size="small"
              actions={[
                { icon: 'edit', onClick: () => alert('Edit') },
                { icon: 'delete', onClick: () => alert('Delete'), color: 'error' },
              ]}
            />
          </Box>
          <Box>
            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
              Medium
            </Typography>
            <ActionButtonsCell
              size="medium"
              actions={[
                { icon: 'edit', onClick: () => alert('Edit') },
                { icon: 'delete', onClick: () => alert('Delete'), color: 'error' },
              ]}
            />
          </Box>
        </Stack>
      </StorySection>

      <StorySection title="In Context (simulated row)">
        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            customer_revenue
          </Typography>
          <Typography variant="body2" color="text.secondary">
            DECIMAL
          </Typography>
          <ActionButtonsCell
            actions={[
              {
                icon: 'info',
                onClick: () => alert('Info'),
                tooltip: 'View details',
              },
            ]}
          />
        </Paper>
      </StorySection>
    </Stack>
  ),
};
