import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppShell } from '../../.storybook/mocks/AppShell';
import OperationsPage from './OperationsPage';
import { archivedRoutes, ITEMS } from './OperationsPage/__stories__/fixtures';

/** The Operations page in the app shell: Export, Archived assets and Scripts as tabs. */
const meta: Meta<typeof OperationsPage> = {
  title: 'Pages/Operations',
  component: OperationsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ArchivedAssets: Story = {
  parameters: { router: { initialEntries: ['/operations?tab=archived'] } },
  render: () => (
    <AppShell path="operations" routes={archivedRoutes(ITEMS)}>
      <OperationsPage />
    </AppShell>
  ),
};

export const Scripts: Story = {
  parameters: { router: { initialEntries: ['/operations?tab=scripts'] } },
  render: () => (
    <AppShell path="operations" routes={[]}>
      <OperationsPage />
    </AppShell>
  ),
};
