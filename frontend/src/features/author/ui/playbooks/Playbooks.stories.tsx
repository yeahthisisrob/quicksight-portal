import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../../.storybook/mocks/api';
import { fakeFlow, PLAYBOOKS, playbookRoutes } from './__stories__/fixtures';
import { PlaybookCatalog } from './PlaybookCatalog';
import { PlaybookFlowView } from './PlaybooksView';
import { RunConfirmDialog } from './RunConfirmDialog';

/**
 * A playbook from setup to done, one story per stage: each is the page a
 * person sees, driven by a canned flow.
 */
const meta: Meta<typeof PlaybookFlowView> = {
  title: 'Features/Author/Playbooks',
  component: PlaybookFlowView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Fixes across the account. Set it up (parameters and conditions), preview what it would touch and why, untick anything to leave alone, confirm, and watch each asset’s outcome. Rows for review link to the Studio.',
      },
    },
  },
  decorators: [
    (Story) => (
      <MockedApi routes={playbookRoutes()}>
        <Box sx={{ p: 3, maxWidth: 1200 }}>
          <Story />
        </Box>
      </MockedApi>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
  render: () => (
    <PlaybookCatalog playbooks={PLAYBOOKS} loading={false} error={null} onOpen={() => {}} />
  ),
};

export const Setup: Story = {
  render: () => <PlaybookFlowView flow={fakeFlow('setup')} />,
};

export const Previewing: Story = {
  render: () => <PlaybookFlowView flow={fakeFlow('previewing')} />,
};

export const Scope: Story = {
  name: 'What it would do',
  render: () => <PlaybookFlowView flow={fakeFlow('scope')} />,
  parameters: {
    docs: {
      description: {
        story:
          'Four to change (ticked), one for review (another workgroup), two held back by conditions, one that could not be read. The chips filter the grid.',
      },
    },
  },
};

export const Confirm: Story = {
  name: 'Confirm, with a canary',
  render: () => (
    <RunConfirmDialog
      open
      playbook={PLAYBOOKS[1]!}
      count={38}
      onClose={() => {}}
      onConfirm={() => {}}
    />
  ),
};

export const ConfirmDelete: Story = {
  name: 'Confirm a delete',
  render: () => (
    <RunConfirmDialog
      open
      playbook={PLAYBOOKS[2]!}
      count={9}
      onClose={() => {}}
      onConfirm={() => {}}
    />
  ),
};

export const Running: Story = {
  render: () => <PlaybookFlowView flow={fakeFlow('running')} />,
};

export const Ran: Story = {
  name: 'Done, with a failure',
  render: () => <PlaybookFlowView flow={fakeFlow('ran')} />,
};
