import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import {
  authorRoutes,
  FULL_MAP,
  fakeFlow,
  previewModelFor,
  resolvedDraft,
  SMUS_NOT_CONFIGURED,
  SOURCE,
  undecidedDraft,
} from './__stories__/fixtures';
import { AuthorStudio, AuthorStudioView } from './AuthorStudio';

/**
 * Two kinds of story. The step stories hand `AuthorStudioView` a canned flow
 * so each step can be looked at in a known state. The full-page stories run
 * the real hook against stubbed HTTP, so the whole flow can be clicked
 * through: pick "Sales overview", choose sales_gold, type an ask, accept the
 * proposal, view the mockup, create the copy.
 */

/** Installed during render: the page's own effects fire before ours would. */
function Mocked({ routes, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(routes));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta: Meta<typeof AuthorStudioView> = {
  title: 'Features/Author/AuthorStudio',
  component: AuthorStudioView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Author page: pick a source, choose datasets (SMUS published assets first), describe the change and review the columns, see a before/after mockup, publish.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// --- full page, real hook ---------------------------------------------------

export const FullPage: Story = {
  name: 'Full page (click through)',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudio initialSource={SOURCE} />
    </Mocked>
  ),
};

export const FullPageNoSource: Story = {
  name: 'Full page, nothing chosen yet',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudio />
    </Mocked>
  ),
};

export const FullPageSmusNotConfigured: Story = {
  name: 'Full page, SMUS not configured',
  render: () => (
    <Mocked routes={authorRoutes([SMUS_NOT_CONFIGURED])}>
      <AuthorStudio initialSource={SOURCE} />
    </Mocked>
  ),
};

// --- steps, canned flow -----------------------------------------------------

export const StepSource: Story = {
  name: '1 · Source',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'source' })} />
    </Mocked>
  ),
};

export const StepTargets: Story = {
  name: '2 · Datasets (SMUS assets)',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'targets', draft: undecidedDraft() })} />
    </Mocked>
  ),
};

export const StepTargetsSmusNotConfigured: Story = {
  name: '2 · Datasets, SMUS not configured',
  render: () => (
    <Mocked routes={authorRoutes([SMUS_NOT_CONFIGURED])}>
      <AuthorStudioView flow={fakeFlow({ step: 'targets' })} />
    </Mocked>
  ),
};

export const StepReviewUndecided: Story = {
  name: '3 · Review, columns to decide',
  render: () => <AuthorStudioView flow={fakeFlow({ step: 'review', draft: undecidedDraft() })} />,
};

export const StepReviewProposed: Story = {
  name: '3 · Review, after a proposal',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'review',
        draft: resolvedDraft(),
        proposal: {
          ask: 'copy this onto sales gold',
          intent: 'rebind',
          mode: 'clone',
          name: 'Sales overview (gold)',
          reason: 'The ask names the gold sales table; every column resolves after two renames.',
          rebinds: [
            {
              identifier: 'sales',
              targetDataSetId: 'sales-gold',
              columnMap: FULL_MAP,
              reason: 'named',
            },
          ],
          unmapped: [],
          plan: resolvedDraft().plan ?? null,
          model: { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-4-6' },
        },
      })}
    />
  ),
};

export const StepMockup: Story = {
  name: '4 · Mockup, renames highlighted',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'mockup',
        draft: resolvedDraft(),
        previewModel: previewModelFor(FULL_MAP),
      })}
    />
  ),
};

export const StepMockupBlocked: Story = {
  name: '4 · Mockup, publishing blocked',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'mockup',
        draft: undecidedDraft(),
        previewModel: previewModelFor({}),
      })}
    />
  ),
};

export const StepPublish: Story = {
  name: '5 · Publish, ready',
  render: () => <AuthorStudioView flow={fakeFlow({ step: 'publish', draft: resolvedDraft() })} />,
};

export const StepPublishRejected: Story = {
  name: '5 · Publish, rejected by QuickSight',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'publish',
        draft: resolvedDraft(),
        publishError:
          'Column net_revenue in dataset sales has type DECIMAL but the visual expects DATETIME',
      })}
    />
  ),
};

export const StepPublished: Story = {
  name: '5 · Published',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'publish',
        draft: resolvedDraft(),
        result: {
          assetType: 'dashboard',
          assetId: 'sales-overview-gold',
          name: 'Sales overview (gold)',
          mode: 'clone',
          versionNumber: 1,
        },
      })}
    />
  ),
};
