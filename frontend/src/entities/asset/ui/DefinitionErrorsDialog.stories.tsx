import { DefinitionErrorsDialog } from './DefinitionErrorsDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DefinitionErrorsDialog> = {
  title: 'Entities/Asset/DefinitionErrorsDialog',
  component: DefinitionErrorsDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the dialog is open',
    },
    assetType: {
      control: 'select',
      options: ['dashboard', 'analysis'],
      description: 'Type of asset with errors',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleErrors = [
  {
    type: 'COLUMN_NOT_FOUND',
    message: 'Column that used in the field can not be found in Dataset',
    violatedEntities: [
      {
        path: 'sheet/0809bd69-baa0-4a50-8002-712b7d2927dd/visual/12e8804f-97c0-4591-b514-3a7f7699fad4/field/b8131bae-8b44-40d6-8005-6c5d3015afc1.3.1749778767210'
      }
    ]
  },
  {
    type: 'COLUMN_NOT_FOUND',
    message: 'Column that used in the filter can not be found in Dataset',
    violatedEntities: [
      {
        path: 'filter-group/5bacd001-3967-4ef6-8adf-6620da4e0d15/filter/c76fa8d0-3d09-46e4-86ba-ff24ffe634ad'
      }
    ]
  },
  {
    type: 'INVALID_REFERENCE',
    message: 'Referenced dataset is no longer available',
    violatedEntities: [
      {
        path: 'dataset/7f0a01e6-dca7-4898-88bb-0f40e2b79b20'
      }
    ]
  },
  {
    type: 'CALCULATED_FIELD_ERROR',
    message: 'Expression in calculated field contains syntax errors',
    violatedEntities: [
      {
        path: 'calculated-field/revenue-growth'
      },
      {
        path: 'calculated-field/profit-margin'
      }
    ]
  }
];

export const DashboardErrors: Story = {
  args: {
    open: true,
    assetName: 'Sales Dashboard',
    assetType: 'dashboard',
    errors: sampleErrors,
    onClose: () => console.log('Dialog closed'),
  },
};

export const AnalysisErrors: Story = {
  args: {
    open: true,
    assetName: 'Revenue Analysis',
    assetType: 'analysis',
    errors: sampleErrors.slice(0, 2),
    onClose: () => console.log('Dialog closed'),
  },
};

export const SingleError: Story = {
  args: {
    open: true,
    assetName: 'Marketing Dashboard',
    assetType: 'dashboard',
    errors: [sampleErrors[0]],
    onClose: () => console.log('Dialog closed'),
  },
};

export const NoViolatedEntities: Story = {
  args: {
    open: true,
    assetName: 'Finance Dashboard',
    assetType: 'dashboard',
    errors: [
      {
        type: 'GENERAL_ERROR',
        message: 'Unable to connect to data source',
      },
      {
        type: 'PERMISSION_ERROR',
        message: 'Insufficient permissions to access some datasets',
      }
    ],
    onClose: () => console.log('Dialog closed'),
  },
};