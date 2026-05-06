import {
  CheckCircle,
  CloudDownload,
  Edit,
  PlaylistAddCheck,
  Settings,
  Storage,
  TrendingUp,
} from '@mui/icons-material';
import { Alert, Stack } from '@mui/material';

import JobProgress from './JobProgress';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Entities/Job/JobProgress',
  component: JobProgress,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Generic step-based progress card. Pure presentational — owners pass step definitions, current index, percent, status, and optional footer. Reused by export and activity-refresh; drop-in for any future job that wants a stepper + linear-progress visual.',
      },
    },
  },
} satisfies Meta<typeof JobProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

const exportSteps = [
  {
    key: 'inventory',
    label: 'Asset Inventory',
    description: 'Discovering assets in QuickSight',
    icon: Storage,
  },
  {
    key: 'enrichment',
    label: 'Enrichment',
    description: 'Fetching detailed metadata',
    icon: TrendingUp,
  },
  {
    key: 'completion',
    label: 'Completion',
    description: 'Export finished',
    icon: CheckCircle,
  },
];

const activitySteps = [
  {
    key: 'initialize',
    label: 'Initialize',
    description: 'Loading cache & planning fetch',
    icon: Settings,
  },
  {
    key: 'fetch-views',
    label: 'Views',
    description: 'Reading dashboard & analysis views',
    icon: CloudDownload,
  },
  {
    key: 'fetch-mutations',
    label: 'Mutations',
    description: 'Reading audit events',
    icon: Edit,
  },
  {
    key: 'merge-and-persist',
    label: 'Persist',
    description: 'Merging & saving',
    icon: PlaylistAddCheck,
  },
];

/** Hidden by default. Set hideWhenIdle=false to render the empty card frame. */
export const Idle: Story = {
  args: {
    title: 'Export Progress',
    steps: exportSteps,
    currentStepIndex: -1,
    phaseStatus: 'idle',
    hideWhenIdle: false,
  },
};

/** First step active, mid-progress. */
export const RunningEarly: Story = {
  args: {
    title: 'Export Progress',
    steps: exportSteps,
    currentStepIndex: 0,
    phaseStatus: 'running',
    progressPercent: 36,
    progressDetails: { label: 'Processing assets', processed: 450, total: 1250 },
    elapsedMs: 15_000,
    statusLabel: 'inventory',
  },
};

/** Middle step active with longer elapsed time. */
export const RunningMid: Story = {
  args: {
    title: 'Export Progress',
    steps: exportSteps,
    currentStepIndex: 1,
    phaseStatus: 'running',
    progressPercent: 71,
    progressDetails: { label: 'Processing assets', processed: 890, total: 1250 },
    elapsedMs: 90_000,
    statusLabel: 'enrichment',
  },
};

export const Completed: Story = {
  args: {
    title: 'Export Progress',
    steps: exportSteps,
    currentStepIndex: 2,
    phaseStatus: 'completed',
    elapsedMs: 120_000,
    statusLabel: 'completed',
  },
};

export const Errored: Story = {
  args: {
    title: 'Export Progress',
    steps: exportSteps,
    currentStepIndex: 1,
    phaseStatus: 'error',
    elapsedMs: 55_000,
    statusLabel: 'Failed',
  },
};

/** Activity-refresh shape: 4 phases, in the middle of fetching mutations. */
export const ActivityFourPhase: Story = {
  args: {
    title: 'Activity Refresh',
    steps: activitySteps,
    currentStepIndex: 2,
    phaseStatus: 'running',
    progressPercent: 80,
    progressDetails: { label: 'Mutation event types fetched', processed: 132, total: 200 },
    elapsedMs: 32_000,
    statusLabel: 'processing',
  },
};

/** With a custom footer slot — shows truncation/error warnings. */
export const WithCustomFooter: Story = {
  args: {
    title: 'Activity Refresh',
    steps: activitySteps,
    currentStepIndex: 3,
    phaseStatus: 'completed',
    elapsedMs: 48_000,
    statusLabel: 'completed',
    footerContent: (
      <Stack spacing={1}>
        <Alert severity="warning" variant="outlined">
          3 event types hit the pagination cap — some older events may be missing.
        </Alert>
        <Alert severity="warning" variant="outlined">
          1 event type failed during this refresh and will retry next time.
        </Alert>
      </Stack>
    ),
  },
};

/** Running with no progress percent — stepper-only display. */
export const NoProgressBar: Story = {
  args: {
    title: 'Activity Refresh',
    steps: activitySteps,
    currentStepIndex: 0,
    phaseStatus: 'running',
    elapsedMs: 2_000,
    statusLabel: 'processing',
  },
};

/** Long-running case — elapsed crosses the hour boundary. */
export const LongRunning: Story = {
  args: {
    title: 'Export Progress',
    steps: exportSteps,
    currentStepIndex: 1,
    phaseStatus: 'running',
    progressPercent: 79,
    progressDetails: { label: 'Processing assets', processed: 98_765, total: 125_000 },
    elapsedMs: 3_900_000,
    statusLabel: 'enrichment',
  },
};
