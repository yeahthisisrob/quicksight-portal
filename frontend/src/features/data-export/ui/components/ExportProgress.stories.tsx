import ExportProgress from './ExportProgress';
import { TwoPhaseExportState } from '../../model/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataExport/ExportProgress',
  component: ExportProgress,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ExportProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseState: TwoPhaseExportState = {
  phase: 'idle',
  currentStep: 0,
  totalAssets: 0,
  processedAssets: 0,
  assetTypes: {},
  timing: {},
  apiCalls: { total: 0, byType: {} },
  exportMode: 'smart',
};

export const Idle: Story = {
  args: {
    exportState: baseState,
  },
};

export const Inventory: Story = {
  args: {
    exportState: {
      ...baseState,
      phase: 'inventory',
      currentStep: 0,
      totalAssets: 1250,
      processedAssets: 450,
      timing: { startTime: Date.now() - 15000 },
    },
  },
};

export const Enrichment: Story = {
  args: {
    exportState: {
      ...baseState,
      phase: 'enrichment',
      currentStep: 1,
      totalAssets: 1250,
      processedAssets: 890,
      timing: { startTime: Date.now() - 45000 },
    },
  },
};

export const Completed: Story = {
  args: {
    exportState: {
      ...baseState,
      phase: 'completed',
      currentStep: 2,
      totalAssets: 1250,
      processedAssets: 1250,
      timing: {
        startTime: Date.now() - 120000,
        endTime: Date.now(),
        totalDuration: 120000,
      },
    },
  },
};

export const Error: Story = {
  args: {
    exportState: {
      ...baseState,
      phase: 'error',
      currentStep: 1,
      totalAssets: 1250,
      processedAssets: 890,
      timing: {
        startTime: Date.now() - 60000,
        endTime: Date.now() - 5000,
      },
    },
  },
};

export const JustStarted: Story = {
  args: {
    exportState: {
      ...baseState,
      phase: 'inventory',
      currentStep: 0,
      totalAssets: 0,
      processedAssets: 0,
      timing: { startTime: Date.now() },
    },
  },
};

export const LongRunning: Story = {
  args: {
    exportState: {
      ...baseState,
      phase: 'enrichment',
      currentStep: 1,
      totalAssets: 125000,
      processedAssets: 98765,
      timing: { startTime: Date.now() - 3600000 }, // 1 hour ago
    },
  },
};