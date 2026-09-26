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
          'The archive ledger on Operations: what was deleted, when, by whom (linked to their QuickSight user) and why, and each time it was restored. Restore in Studio opens it there, to fix its errors before it comes back; folders, users and groups are record only.',
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
