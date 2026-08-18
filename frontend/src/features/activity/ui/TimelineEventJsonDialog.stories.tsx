import { TimelineEventJsonDialog } from './TimelineEventJsonDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TimelineEventJsonDialog> = {
  title: 'Features/Activity/TimelineEventJsonDialog',
  component: TimelineEventJsonDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Debug view of a timeline event: the stored compact activity record (including the allowlisted CloudTrail payload slice for mutations) plus the hydrated wire event.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsoleUpdateAnalysis: Story = {
  args: {
    open: true,
    onClose: () => {},
    event: {
      id: '2026-08-17T14:00:00Z_UpdateAnalysis_abc-123_jane.doe',
      timestamp: '2026-08-17T14:00:00Z',
      eventName: 'UpdateAnalysis',
      kind: 'mutation',
      action: 'update',
      user: 'jane.doe',
      resourceType: 'analysis',
      assetType: 'analysis',
      assetId: 'abc-123',
      assetName: 'Regional Sales Deep Dive',
      raw: {
        timestamp: '2026-08-17T14:00:00Z',
        eventName: 'UpdateAnalysis',
        user: 'jane.doe',
        resourceId: 'abc-123',
        kind: 'mutation',
        action: 'update',
        resourceType: 'analysis',
        eventId: 'f2a7c9e1-1111-2222-3333-444455556666',
        details: {
          eventRequestDetails: [
            { key: 'addSheet', value: { sheetId: 'arn:aws:quicksight:us-east-1:123:sheet/x', sheetName: 'Sheet 2' } },
            { key: 'analysisId', value: 'arn:aws:quicksight:us-east-1:123:analysis/abc-123' },
          ],
        },
      } as any,
    },
  },
};

export const NameMissDebugging: Story = {
  args: {
    open: true,
    onClose: () => {},
    event: {
      id: '2026-08-17T13:00:00Z_UpdateAnalysis__john.doe',
      timestamp: '2026-08-17T13:00:00Z',
      eventName: 'UpdateAnalysis',
      kind: 'mutation',
      action: 'update',
      user: 'john.doe',
      resourceType: 'analysis',
      assetType: 'analysis',
      raw: {
        timestamp: '2026-08-17T13:00:00Z',
        eventName: 'UpdateAnalysis',
        user: 'john.doe',
        kind: 'mutation',
        action: 'update',
        resourceType: 'analysis',
        eventId: 'a1b2c3d4-aaaa-bbbb-cccc-ddddeeeeffff',
      } as any,
    },
  },
};
