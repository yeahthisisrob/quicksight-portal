import type { Meta, StoryObj } from '@storybook/react-vite';

import { useMockApi } from '../../../../.storybook/mocks/api';
import {
  VERSIONS,
  versionHistoryRoutes,
} from '../../../entities/asset-version/lib/__fixtures__/versions';
import { RecentChangesPanel } from './RecentChangesPanel';

/**
 * Operations › History: what changed lately across the account, with the
 * counts on the same strip every summary uses; a row opens the asset's
 * full history.
 */
const meta: Meta<typeof RecentChangesPanel> = {
  title: 'Features/History/RecentChangesPanel',
  component: RecentChangesPanel,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Mocked({ empty = false }: { empty?: boolean }) {
  useMockApi(versionHistoryRoutes(empty ? [] : VERSIONS));
  return <RecentChangesPanel />;
}

export const Loaded: Story = { render: () => <Mocked /> };
export const Empty: Story = { render: () => <Mocked empty /> };
