import type { Meta, StoryObj } from '@storybook/react-vite';

import { exportRoutes } from '@/features/data-export/ui/__stories__/routes';
import { STATUS_EXPORTED, smusExportRoutes } from '@/features/smus/ui/__stories__/fixtures';

import { AppShell } from '../../.storybook/mocks/AppShell';
import OperationsPage from './OperationsPage';
import { archivedRoutes, ITEMS } from './OperationsPage/__stories__/fixtures';

/**
 * The Operations page in the app shell, API stubbed: the QuickSight export,
 * the SageMaker Unified Studio export and archived assets as tabs.
 */
const meta: Meta<typeof OperationsPage> = {
  title: 'Pages/Operations',
  component: OperationsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Export: Story = {
  parameters: { router: { initialEntries: ['/operations'] } },
  render: () => (
    <AppShell path="operations" routes={exportRoutes()}>
      <OperationsPage />
    </AppShell>
  ),
};

export const Smus: Story = {
  name: 'SMUS: exported',
  parameters: { router: { initialEntries: ['/operations?tab=smus'] } },
  render: () => (
    <AppShell path="operations" routes={smusExportRoutes(STATUS_EXPORTED)}>
      <OperationsPage />
    </AppShell>
  ),
};

export const ArchivedAssets: Story = {
  parameters: { router: { initialEntries: ['/operations?tab=archived'] } },
  render: () => (
    <AppShell path="operations" routes={archivedRoutes(ITEMS)}>
      <OperationsPage />
    </AppShell>
  ),
};
