import { Box } from '@mui/material';
import { SnackbarProvider } from 'notistack';

import MultipleExpressionsDisplay from './MultipleExpressionsDisplay';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof MultipleExpressionsDisplay> = {
  title: 'Features/DataCatalog/MultipleExpressionsDisplay',
  component: MultipleExpressionsDisplay,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Displays the distinct expression variants for a calculated field. When the same field name resolves to more than one expression across assets, each variant is shown with the assets that use it — surfacing expression conflicts.',
      },
    },
  },
  decorators: [
    (Story) => (
      <SnackbarProvider>
        <Box sx={{ maxWidth: 720 }}>
          <Story />
        </Box>
      </SnackbarProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultipleExpressionsDisplay>;

const conflictingExpressions = [
  {
    expression: '({revenue} - {cost}) / {revenue} * 100',
    sources: [
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
      { assetType: 'dashboard', assetId: 'db-2', assetName: 'Exec Dashboard' },
    ],
  },
  {
    expression: 'ifelse({revenue} > 0, ({revenue} - {cost}) / {revenue} * 100, 0)',
    sources: [{ assetType: 'analysis', assetId: 'an-1', assetName: 'Profit Analysis' }],
  },
  {
    expression: '({total_revenue} - {total_cost}) / {total_revenue} * 100',
    sources: [{ assetType: 'dataset', assetId: 'ds-1', assetName: 'Finance Dataset' }],
  },
];

export const ConflictingExpressions: Story = {
  args: {
    expressions: conflictingExpressions,
    onShowGraph: (expression: string) => alert(`Show graph for: ${expression}`),
  },
};

export const SingleExpression: Story = {
  args: {
    primaryExpression: 'sum({amount})',
    onShowGraph: (expression: string) => alert(`Show graph for: ${expression}`),
  },
};

export const CompactBadge: Story = {
  args: {
    expressions: conflictingExpressions,
    compact: true,
  },
};
