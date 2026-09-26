import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../.storybook/mocks/api';
import { archivedRoutes, ITEMS } from './__stories__/fixtures';
import { ArchivedAssetsPanel } from './ArchivedAssetsPanel';

const meta = {
  title: 'Pages/Operations/ArchivedAssetsPanel',
  component: ArchivedAssetsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Deleted assets the portal kept a copy of, with restore and JSON viewing. Shown on the Operations page under the Archived assets tab.',
      },
    },
  },
} satisfies Meta<typeof ArchivedAssetsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAssets: Story = {
  render: () => (
    <MockedApi routes={archivedRoutes(ITEMS)}>
      <ArchivedAssetsPanel />
    </MockedApi>
  ),
};

export const Empty: Story = {
  render: () => (
    <MockedApi routes={archivedRoutes([])}>
      <ArchivedAssetsPanel />
    </MockedApi>
  ),
};

export const LoadError: Story = {
  render: () => (
    <MockedApi routes={archivedRoutes([], 'The archive index could not be read')}>
      <ArchivedAssetsPanel />
    </MockedApi>
  ),
};
