import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import {
  SNAPSHOT_NO_PROJECTS,
  STATUS_EXPORTED,
  STATUS_NEVER_EXPORTED,
  STATUS_NOT_CONFIGURED,
  smusExportRoutes,
} from './__stories__/fixtures';
import { SmusExportPanel } from './SmusExportPanel';

/** Installed during render, before the panel's first request. */
function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta: Meta<typeof SmusExportPanel> = {
  title: 'Features/SMUS/SmusExportPanel',
  component: SmusExportPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The SageMaker Unified Studio card on Operations: what the last export captured, the portal role’s standing in the domain, and a button to run a new export that is followed to completion. Click "Run export" in any story to watch the job.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Exported: Story = {
  render: () => (
    <Mocked routes={smusExportRoutes(STATUS_EXPORTED)}>
      <SmusExportPanel />
    </Mocked>
  ),
};

export const NeverExported: Story = {
  render: () => (
    <Mocked routes={smusExportRoutes(STATUS_NEVER_EXPORTED)}>
      <SmusExportPanel />
    </Mocked>
  ),
};

export const RoleSeesNoProject: Story = {
  render: () => (
    <Mocked routes={smusExportRoutes({ ...STATUS_EXPORTED, snapshot: SNAPSHOT_NO_PROJECTS })}>
      <SmusExportPanel />
    </Mocked>
  ),
};

export const NotConfigured: Story = {
  render: () => (
    <Mocked routes={smusExportRoutes(STATUS_NOT_CONFIGURED)}>
      <SmusExportPanel />
    </Mocked>
  ),
};

export const ExportFails: Story = {
  render: () => (
    <Mocked routes={smusExportRoutes(STATUS_EXPORTED, { failJob: true })}>
      <SmusExportPanel />
    </Mocked>
  ),
};

export const StatusUnavailable: Story = {
  render: () => (
    <Mocked routes={smusExportRoutes(STATUS_EXPORTED, { statusError: 'Cache bucket unreachable' })}>
      <SmusExportPanel />
    </Mocked>
  ),
};
