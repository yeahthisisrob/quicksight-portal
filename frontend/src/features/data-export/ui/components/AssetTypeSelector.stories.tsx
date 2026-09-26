import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';

import type { AssetType } from '../../model/types';
import AssetTypeSelector from './AssetTypeSelector';

const meta = {
  title: 'Features/DataExport/AssetTypeSelector',
  component: AssetTypeSelector,
  parameters: {
    layout: 'padded',
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
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    const onToggle = (assetType: AssetType) =>
      updateArgs({
        selectedTypes: args.selectedTypes.includes(assetType)
          ? args.selectedTypes.filter((t) => t !== assetType)
          : [...args.selectedTypes, assetType],
      });
    return <AssetTypeSelector {...args} onToggle={onToggle} />;
  },
} satisfies Meta<typeof AssetTypeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Chips toggle live. */
export const Default: Story = {};

/** While an export runs every chip is inert. */
export const Disabled: Story = {
  args: { disabled: true },
};
