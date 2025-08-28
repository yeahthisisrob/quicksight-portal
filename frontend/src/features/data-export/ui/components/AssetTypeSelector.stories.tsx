import { useState } from 'react';

import AssetTypeSelector from './AssetTypeSelector';
import { AssetType } from '../../model/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataExport/AssetTypeSelector',
  component: AssetTypeSelector,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof AssetTypeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [selectedTypes, setSelectedTypes] = useState<AssetType[]>(args.selectedTypes);
    
    const handleToggle = (assetType: AssetType) => {
      setSelectedTypes(prev =>
        prev.includes(assetType)
          ? prev.filter(t => t !== assetType)
          : [...prev, assetType]
      );
    };

    return (
      <AssetTypeSelector
        {...args}
        selectedTypes={selectedTypes}
        onToggle={handleToggle}
      />
    );
  },
  args: {
    selectedTypes: ['dashboards', 'datasets'],
    onToggle: () => {},
    counts: {
      dashboards: 125,
      datasets: 89,
      analyses: 234,
      datasources: 12,
      folders: 45,
      users: 156,
      groups: 23,
      themes: 0,
    },
    disabled: false,
  },
};

export const AllSelected: Story = {
  render: Default.render,
  args: {
    selectedTypes: ['dashboards', 'datasets', 'analyses', 'datasources', 'folders', 'groups', 'users'],
    onToggle: () => {},
    counts: {
      dashboards: 125,
      datasets: 89,
      analyses: 234,
      datasources: 12,
      folders: 45,
      users: 156,
      groups: 23,
      themes: 0,
    },
    disabled: false,
  },
};

export const NoneSelected: Story = {
  render: Default.render,
  args: {
    selectedTypes: [],
    onToggle: () => {},
    counts: {
      dashboards: 125,
      datasets: 89,
      analyses: 234,
      datasources: 12,
      folders: 45,
      users: 156,
      groups: 23,
      themes: 0,
    },
    disabled: false,
  },
};

export const NoCounts: Story = {
  render: Default.render,
  args: {
    selectedTypes: ['dashboards', 'datasets'],
    onToggle: () => {},
    counts: undefined,
    disabled: false,
  },
};

export const Disabled: Story = {
  render: Default.render,
  args: {
    selectedTypes: ['dashboards', 'datasets'],
    onToggle: () => {},
    counts: {
      dashboards: 125,
      datasets: 89,
      analyses: 234,
      datasources: 12,
      folders: 45,
      users: 156,
      groups: 23,
      themes: 0,
    },
    disabled: true,
  },
};

export const LargeNumbers: Story = {
  render: Default.render,
  args: {
    selectedTypes: ['dashboards', 'datasets', 'analyses'],
    onToggle: () => {},
    counts: {
      dashboards: 12500,
      datasets: 8900,
      analyses: 23400,
      datasources: 1200,
      folders: 4500,
      users: 15600,
      groups: 2300,
      themes: 0,
    },
    disabled: false,
  },
};