import type { Meta, StoryObj } from '@storybook/react-vite';

import { PLAN_NEW_DATASET, PLAN_ON_GOVERNED, PLAN_WITHOUT_SMUS } from './__stories__/assistant';
import { PlanLineage } from './PlanLineage';

/**
 * What a change will build, drawn before the assistant prepares it: the
 * SMUS listing (when SMUS is used), the dataset (existing, or new and
 * through which data source), and the analysis or dashboard.
 */
const meta: Meta<typeof PlanLineage> = {
  title: 'Features/Author/Assistant plan lineage',
  component: PlanLineage,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTheGovernedDataset: Story = {
  name: 'Reuses the dataset linked to the listing',
  args: { plan: PLAN_ON_GOVERNED as never },
};

export const NewDataset: Story = {
  name: 'Creates a dataset through the Athena source, edits a dashboard',
  args: { plan: PLAN_NEW_DATASET as never },
};

export const WithoutSmus: Story = {
  name: 'No SMUS: datasets straight to the asset',
  args: { plan: PLAN_WITHOUT_SMUS as never },
};
