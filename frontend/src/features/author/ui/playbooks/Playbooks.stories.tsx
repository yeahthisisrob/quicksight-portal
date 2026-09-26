import { Box, Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../../.storybook/mocks/api';
import { BLANK_SPEC } from '../../model/usePlaybookBuilder';
import { EXAMPLE_SPEC, fakeFlow, PLAYBOOKS, playbookRoutes } from './__stories__/fixtures';
import { PlaybookBuilder } from './PlaybookBuilder';
import { PlaybookCatalog } from './PlaybookCatalog';
import { PlaybookFlowView } from './PlaybooksView';
import { RunConfirmDialog } from './RunConfirmDialog';
import { SavedReports } from './SavedReports';

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

const noop = () => {};

export const Catalog: Story = {
  render: () => (
    <Stack spacing={3}>
      <PlaybookCatalog
        playbooks={PLAYBOOKS}
        loading={false}
        error={null}
        onOpen={noop}
        actions={{ onCreate: noop, onCopy: noop, onEdit: noop, onDelete: noop }}
      />
      <SavedReports />
    </Stack>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The shipped playbooks, including two built from specs (copy them to start your own), yours with change and delete, and saved reports.',
      },
    },
  },
};

export const BuilderNew: Story = {
  name: 'Builder · new',
  render: () => (
    <PlaybookBuilder
      initial={BLANK_SPEC}
      title="New playbook"
      saving={false}
      error={null}
      onSave={noop}
      onCancel={noop}
    />
  ),
};

export const BuilderCopy: Story = {
  name: 'Builder · a copy of the Redshift example',
  render: () => (
    <PlaybookBuilder
      initial={EXAMPLE_SPEC}
      title="Copy a playbook"
      saving={false}
      error={null}
      onSave={noop}
      onCancel={noop}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Inputs, what to select (busy dashboards still on Redshift), and the steps: match a governed Athena dataset (a model maps names that differ), rebind, tag the old dataset and data source deprecated.',
      },
    },
  },
};

export const BuilderRejected: Story = {
  name: 'Builder · the server says what is wrong',
  render: () => (
    <PlaybookBuilder
      initial={{ ...EXAMPLE_SPEC, steps: [{ kind: 'rebind' }] }}
      title="Change a playbook"
      saving={false}
      error="steps[0] (rebind) needs a matchDataset step before it"
      onSave={noop}
      onCancel={noop}
    />
  ),
};

export const SetupWithModel: Story = {
  name: 'Setup · asks a model',
  render: () => (
    <PlaybookFlowView
      flow={fakeFlow('setup', {
        playbook: PLAYBOOKS[3]!,
        params: { minViews: 50, fromEngine: 'REDSHIFT', toEngine: 'ATHENA', infer: true },
      })}
    />
  ),
};

export const SetupFolder: Story = {
  name: 'Setup · a team into its folder',
  render: () => (
    <PlaybookFlowView
      flow={fakeFlow('setup', { playbook: PLAYBOOKS[4]!, params: { team: 'sales-team' } })}
    />
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

export const RanCanary: Story = {
  name: 'Done with a canary, more to run',
  render: () => (
    <PlaybookFlowView
      flow={fakeFlow('ran', { remaining: ['000#dataset#x', '000#dataset#y', '000#dataset#z'] })}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'After a canary (or a stopped or halted run), "Run the other 3" runs only what it did not get to, through the same confirmation.',
      },
    },
  },
};

export const Ran: Story = {
  name: 'Done, with a failure',
  render: () => <PlaybookFlowView flow={fakeFlow('ran')} />,
};
