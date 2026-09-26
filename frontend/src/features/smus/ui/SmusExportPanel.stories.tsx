import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import {
  SNAPSHOT_NO_PROJECTS,
  STATUS_EXPORTED,
  STATUS_NEVER_EXPORTED,
  STATUS_NOT_CONFIGURED,
  smusExportRoutes,
} from './__stories__/fixtures';
import { SmusExportPanel } from './SmusExportPanel';

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
    <MockedApi routes={smusExportRoutes(STATUS_EXPORTED)}>
      <SmusExportPanel />
    </MockedApi>
  ),
};

export const NeverExported: Story = {
  render: () => (
    <MockedApi routes={smusExportRoutes(STATUS_NEVER_EXPORTED)}>
      <SmusExportPanel />
    </MockedApi>
  ),
};

export const RoleSeesNoProject: Story = {
  render: () => (
    <MockedApi routes={smusExportRoutes({ ...STATUS_EXPORTED, snapshot: SNAPSHOT_NO_PROJECTS })}>
      <SmusExportPanel />
    </MockedApi>
  ),
};

export const NotConfigured: Story = {
  render: () => (
    <MockedApi routes={smusExportRoutes(STATUS_NOT_CONFIGURED)}>
      <SmusExportPanel />
    </MockedApi>
  ),
};

export const StatusUnavailable: Story = {
  render: () => (
    <MockedApi
      routes={smusExportRoutes(STATUS_EXPORTED, { statusError: 'Cache bucket unreachable' })}
    >
      <SmusExportPanel />
    </MockedApi>
  ),
};
