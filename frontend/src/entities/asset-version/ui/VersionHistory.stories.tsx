import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { useMockApi } from '../../../../.storybook/mocks/api';
import { VERSIONS, versionHistoryRoutes } from '../lib/__fixtures__/versions';
import { VersionHistory } from './VersionHistory';
import { VersionHistoryDialog } from './VersionHistoryDialog';

/**
 * The versions an asset has been through: who changed it, what changed in
 * words, compared with the version before, another, or what is live now,
 * and put back with one click.
 */
const meta: Meta<typeof VersionHistory> = {
  title: 'Entities/AssetVersion/VersionHistory',
  component: VersionHistory,
  parameters: { layout: 'padded' },
  args: { assetType: 'analysis', assetId: 'an-sales', assetName: 'Sales review' },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Mocked({ children, empty = false }: { children: React.ReactNode; empty?: boolean }) {
  useMockApi(versionHistoryRoutes(empty ? [] : VERSIONS));
  return <>{children}</>;
}

export const Split: Story = {
  render: (args) => (
    <Mocked>
      <VersionHistory {...args} layout="split" />
    </Mocked>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('4 versions kept')).toBeInTheDocument();
    await userEvent.click(await canvas.findByText('1 visual removed, 1 calculated field changed'));
    await expect(
      await canvas.findByText('Changed margin to subtract tax: {rev}-{cost}-{tax}')
    ).toBeInTheDocument();
  },
};

export const Stacked: Story = {
  name: 'Stacked (the Studio panel)',
  render: (args) => (
    <div style={{ maxWidth: 420 }}>
      <Mocked>
        <VersionHistory {...args} layout="stacked" />
      </Mocked>
    </div>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Mocked empty>
      <VersionHistory {...args} />
    </Mocked>
  ),
};

export const AsDialog: Story = {
  render: (args) => (
    <Mocked>
      <VersionHistoryDialog {...args} open onClose={() => {}} />
    </Mocked>
  ),
};
