import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { type MockRoute, useMockApi } from '../../../../../.storybook/mocks/api';
import { searchRoute } from '../../../../../.storybook/mocks/search';
import type { DatasetOption } from '../../lib/useRebindDraft';
import { TargetDatasetPicker } from './TargetDatasetPicker';

const DATASETS = [
  { id: 'sales-gold', name: 'sales_gold' },
  { id: 'sales-silver', name: 'sales_silver' },
  { id: 'customers-dim', name: 'customers_dim' },
  { id: 'targets-2025', name: 'targets_2025' },
];

const routes: MockRoute[] = [
  searchRoute(),
  {
    method: 'get',
    url: /\/assets\/datasets\/paginated/,
    respond: (config) => {
      const search = String((config.params as { search?: string })?.search ?? '').toLowerCase();
      const datasets = DATASETS.filter((d) => !search || d.name.includes(search));
      return {
        body: {
          success: true,
          data: { datasets, totalItems: datasets.length, page: 1, pageSize: 25, totalPages: 1 },
        },
      };
    },
  },
];

function Demo({ initialInput }: { initialInput?: string }) {
  useMockApi(routes);
  const [value, setValue] = useState<DatasetOption | null>(null);
  return (
    <Box sx={{ maxWidth: 520 }}>
      <TargetDatasetPicker
        value={value}
        onChange={setValue}
        currentId="sales-silver"
        initialInput={initialInput}
      />
    </Box>
  );
}

const meta: Meta<typeof TargetDatasetPicker> = {
  title: 'Entities/Definition/TargetDatasetPicker',
  component: TargetDatasetPicker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'An empty box lists datasets by name. Typing two or more characters searches them in plain words through /search (name, columns, calculated fields, tags, folders), and each option says why it matched.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Browse: Story = {
  render: () => <Demo />,
};

export const SearchMode: Story = {
  name: 'Searched: "gold revenue region"',
  render: () => <Demo initialInput="gold revenue region" />,
};
