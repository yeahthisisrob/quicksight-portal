import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../.storybook/mocks/api';
import { archivedRoutes, ITEMS } from './__stories__/fixtures';
import { ArchivedAssetsPanel } from './ArchivedAssetsPanel';

/** Installed during render, before the panel's first fetch. */
function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

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
    <Mocked routes={archivedRoutes(ITEMS)}>
      <ArchivedAssetsPanel />
    </Mocked>
  ),
};

export const Empty: Story = {
  render: () => (
    <Mocked routes={archivedRoutes([])}>
      <ArchivedAssetsPanel />
    </Mocked>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Mocked routes={archivedRoutes([], 'The archive index could not be read')}>
      <ArchivedAssetsPanel />
    </Mocked>
  ),
};
