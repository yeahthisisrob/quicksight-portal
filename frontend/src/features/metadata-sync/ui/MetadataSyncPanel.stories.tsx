import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import {
  metadataSyncRoutes,
  STATUS_IN_STEP,
  STATUS_NEEDS_SMUS,
  STATUS_NEVER_RUN,
  STATUS_OFF,
  STATUS_PREVIEWED,
  STATUS_REFUSED,
} from './__stories__/fixtures';
import { MetadataSyncPanel } from './MetadataSyncPanel';

const meta: Meta<typeof MetadataSyncPanel> = {
  title: 'Features/Metadata sync/MetadataSyncPanel',
  component: MetadataSyncPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Metadata sync card on Operations: table and column descriptions kept the same in Glue and SageMaker Unified Studio. A preview writes nothing; a run adopts edits and copies them; a field two places disagree on waits for a pick. Off until Settings turns it on.',
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

/** A preview with edits to adopt, fields to write and one conflict to settle. */
export const Previewed: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_PREVIEWED)}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};

export const InStep: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_IN_STEP)}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};

/** The role was not granted the write: the refusal AWS gave is shown beside the table. */
export const WriteRefused: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_REFUSED)}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};

export const NeverRun: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_NEVER_RUN)}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};

export const TurnedOff: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_OFF)}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};

export const NeedsSmus: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_NEEDS_SMUS)}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};

export const StatusUnavailable: Story = {
  render: () => (
    <MockedApi routes={metadataSyncRoutes(STATUS_OFF, { statusError: 'Bucket unreachable' })}>
      <MetadataSyncPanel />
    </MockedApi>
  ),
};
