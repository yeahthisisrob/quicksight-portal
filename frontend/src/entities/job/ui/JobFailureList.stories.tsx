import JobFailureList from './JobFailureList';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof JobFailureList> = {
  title: 'Entities/Job/JobFailureList',
  component: JobFailureList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Item-level failures from a bulk job (job.failures), shown inside the dialog that queued the job so the user sees which items failed and why.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof JobFailureList>;

export const PartialFailure: Story = {
  args: {
    title: '2 of 5 users could not be added to analysts',
    failures: [
      { item: 'alice → analysts', error: 'User not found in namespace default' },
      { item: 'bob → analysts', error: 'Rate exceeded' },
    ],
  },
};

export const SummaryOnly: Story = {
  args: {
    title: 'Operation failed',
    failures: [],
    summary: 'Bulk operation failed: Group analysts not found',
  },
};

export const ManyFailures: Story = {
  args: {
    title: '12 users could not be removed from analysts',
    failures: Array.from({ length: 12 }, (_, i) => ({
      item: `user${i} → analysts`,
      error: 'No value provided for HTTP label: MemberName.',
    })),
  },
};

export const Nothing: Story = {
  args: { title: 'Unused', failures: [] },
};
