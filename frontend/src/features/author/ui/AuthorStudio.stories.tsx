import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { draftsFromSpecs, newVisual } from '../model/newAsset';
import {
  authorRoutes,
  EDITOR_OPS,
  FRESH_DATASETS,
  FRESH_PROPOSAL,
  FULL_MAP,
  fakeFlow,
  PROPOSED_OPS,
  PROPOSED_VISUALS,
  previewModelFor,
  REPAIR_PLAN,
  repairPlanRoute,
  resolvedDraft,
  SMUS_NOT_CONFIGURED,
  SMUS_NOT_EXPORTED,
  SOURCE,
  STANDARD_RULES,
  STANDARD_TEMPLATE,
  undecidedDraft,
} from './__stories__/fixtures';
import { AuthorStudio, AuthorStudioView } from './AuthorStudio';
import { SourceStep } from './steps/SourceStep';

/**
 * Two kinds of story. The step stories hand `AuthorStudioView` a canned flow
 * so each step can be looked at in a known state. The full-page stories run
 * the real hook against stubbed HTTP, so the whole flow can be clicked
 * through: pick "Sales overview", choose sales_gold, type an ask, accept the
 * proposal, edit the mockup, pick a folder, create the copy.
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
          'The Author page: pick a source ranked by use, choose datasets (SMUS published assets first), describe the change and review the columns, see and edit a before/after mockup, publish into a folder.',
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

export const FullPageRepair: Story = {
  name: 'Full page, source with errors (repair)',
  render: () => (
    <Mocked routes={authorRoutes([repairPlanRoute(REPAIR_PLAN)])}>
      <AuthorStudio initialSource={SOURCE} />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The source cannot be written as it is. A Repair step appears after Source with each issue and its proposed fix; the dataset that cannot be read needs a target chosen before the flow continues.',
      },
    },
  },
};

// --- steps, canned flow -----------------------------------------------------

export const StepRepair: Story = {
  name: '1b · Repair: issues found',
  render: () => (
    <Mocked routes={authorRoutes([repairPlanRoute(REPAIR_PLAN)])}>
      <AuthorStudioView flow={fakeFlow({ step: 'repair', repairPlan: REPAIR_PLAN })} />
    </Mocked>
  ),
};

export const StepRepairClean: Story = {
  name: '1b · Repair: clean (step hidden)',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'source' })} />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story: 'With nothing to repair the rail goes straight from Source to Datasets.',
      },
    },
  },
};

export const StepSource: Story = {
  name: '1 · Source, ranked with badges',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'source' })} />
    </Mocked>
  ),
};

export const StepSourceSearch: Story = {
  name: '1 · Source, searched in plain words',
  parameters: {
    docs: {
      description: {
        story:
          'Typing searches dashboards by name, column, calculated field, tag or folder through /search; each hit says why it matched.',
      },
    },
  },
  render: () => (
    <Mocked routes={authorRoutes()}>
      <Box sx={{ p: 3, maxWidth: 1200 }}>
        <SourceStep flow={fakeFlow({ step: 'source' })} initialSearch="sales revenue" />
      </Box>
    </Mocked>
  ),
};

export const StepSourceInsights: Story = {
  name: '1 · Source, insights and health on the preview',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'source' })} />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The selected dashboard shows its views, viewers and p90 load time; the table is flagged slow and the line chart flagged for load errors.',
      },
    },
  },
};

export const StepSourceNoInsights: Story = {
  name: '1 · Source, no insights available',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'source', insights: null })} />
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

export const StepTargetsSmusNotExported: Story = {
  name: '2 · Datasets, no SMUS export yet',
  render: () => (
    <Mocked routes={authorRoutes([SMUS_NOT_EXPORTED])}>
      <AuthorStudioView flow={fakeFlow({ step: 'targets' })} />
    </Mocked>
  ),
};

export const StepReviewUndecided: Story = {
  name: '3 · Review, columns to decide',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'review', draft: undecidedDraft() })} />
    </Mocked>
  ),
};

export const StepReviewProposed: Story = {
  name: '3 · Review, after a proposal',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'review',
          draft: resolvedDraft(),
          ops: PROPOSED_OPS,
          proposal: {
            ask: 'copy this onto sales gold',
            intent: 'rebind',
            mode: 'clone',
            name: 'Sales overview (gold)',
            reason:
              'The ask names the gold sales table; every column resolves after two renames. Revenue by region reads better as columns.',
            rebinds: [
              {
                identifier: 'sales',
                targetDataSetId: 'sales-gold',
                columnMap: FULL_MAP,
                reason: 'named',
              },
            ],
            unmapped: [],
            ops: PROPOSED_OPS,
            plan: resolvedDraft().plan ?? null,
            model: { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-4-6' },
          },
        })}
      />
    </Mocked>
  ),
};

export const StepStandardTemplate: Story = {
  name: '4 · Standard: pick a template',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({ step: 'standard', draft: resolvedDraft(), template: STANDARD_TEMPLATE })}
    />
  ),
};

export const StepStandardRules: Story = {
  name: '4 · Standard: rules',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'standard',
        draft: resolvedDraft(),
        template: STANDARD_TEMPLATE,
        typeRules: STANDARD_RULES,
      })}
    />
  ),
};

export const StepStandardEmpty: Story = {
  name: '4 · Standard: nothing chosen (skippable)',
  render: () => <AuthorStudioView flow={fakeFlow({ step: 'standard', draft: resolvedDraft() })} />,
};

export const StepMockupMigrated: Story = {
  name: '5 · Mockup: migrated with warnings',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'mockup',
        draft: resolvedDraft(),
        template: STANDARD_TEMPLATE,
        typeRules: STANDARD_RULES,
      })}
    />
  ),
};

export const StepPublishMigration: Story = {
  name: '6 · Publish: migration summary',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'publish',
        draft: resolvedDraft(),
        template: STANDARD_TEMPLATE,
        typeRules: STANDARD_RULES,
        folder: { id: 'fld-sales-eu', name: 'EMEA', path: '/Sales/EMEA' },
      })}
    />
  ),
};

export const StepMockup: Story = {
  name: '5 · Mockup, renames highlighted',
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

export const StepMockupEditor: Story = {
  name: '5 · Mockup editor, inspector open',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'mockup',
          draft: resolvedDraft(),
          ops: EDITOR_OPS.slice(0, 2),
          selectedElement: { sheetId: 'sheet-overview', elementId: 'bar-region' },
        })}
      />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The bar chart is selected: the inspector shows its title, type, position and size. It has already been retitled and retyped, so the card carries a "bar chart → line chart" chip.',
      },
    },
  },
};

export const StepMockupChanges: Story = {
  name: '5 · Mockup, every kind of change',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'mockup',
          draft: resolvedDraft(),
          ops: EDITOR_OPS,
          addedFields: [
            {
              templateId: 't-net-margin',
              identifier: 'sales',
              name: 'net_margin',
              expression: '{revenue} - {cost} - {returns}',
            },
          ],
        })}
      />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Renamed fields, a retyped chart, a moved KPI, a resized KPI, a removed line chart (a ghost on the Before view), a duplicated table and a renamed sheet: the change list and the diff chips say it all.',
      },
    },
  },
};

export const StepMockupEditsOnly: Story = {
  name: '5 · Mockup, edits without a rebind',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'mockup',
          ops: EDITOR_OPS.slice(2, 5),
          selectedElement: { sheetId: 'sheet-overview', elementId: 'kpi-orders' },
        })}
      />
    </Mocked>
  ),
};

export const StepMockupBlocked: Story = {
  name: '5 · Mockup, publishing blocked',
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
  name: '6 · Publish, ready',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'publish', draft: resolvedDraft() })} />
    </Mocked>
  ),
};

export const StepPublishFolder: Story = {
  name: '6 · Publish, into a folder with edits',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'publish',
          draft: resolvedDraft(),
          ops: EDITOR_OPS.slice(0, 3),
          folder: { id: 'fld-sales-eu', name: 'EMEA', path: '/Sales/EMEA' },
          addedFields: [
            {
              templateId: 't-net-margin',
              identifier: 'sales',
              name: 'net_margin',
              expression: '{revenue} - {cost} - {returns}',
            },
          ],
        })}
      />
    </Mocked>
  ),
};

export const StepPublishRejected: Story = {
  name: '6 · Publish, rejected by QuickSight',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'publish',
          draft: resolvedDraft(),
          publishError:
            'Column net_revenue in dataset sales has type DECIMAL but the visual expects DATETIME',
        })}
      />
    </Mocked>
  ),
};

// --- from nothing -----------------------------------------------------------

/** The planner's five visuals as editable cards. */
const proposedDrafts = () => draftsFromSpecs(PROPOSED_VISUALS);

export const NewDatasets: Story = {
  name: 'New · Datasets',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView flow={fakeFlow({ step: 'targets', fresh: { datasets: FRESH_DATASETS } })} />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Two datasets chosen, each under the identifier its columns are addressed by, with the columns read from the export cache. A third can be added from SMUS or QuickSight below.',
      },
    },
  },
};

export const NewVisualsProposed: Story = {
  name: 'New · Visuals: proposed',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'visuals',
          ask: 'revenue and orders this year, revenue by region and channel, a monthly trend, top customers',
          freshProposal: FRESH_PROPOSAL,
          fresh: { datasets: FRESH_DATASETS, visuals: proposedDrafts() },
        })}
      />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The ask went to the planner and its five visuals came back as cards: two KPIs, a bar chart by region coloured by channel, a monthly trend on a date column with its granularity, and a table. Every field is editable and each edit re-previews.',
      },
    },
  },
};

export const NewVisualsByHand: Story = {
  name: 'New · Visuals: by hand',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'visuals',
          fresh: {
            datasets: FRESH_DATASETS,
            visuals: [{ ...proposedDrafts()[2]!, color: undefined }, newVisual('targets')],
          },
        })}
      />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'One visual built by naming columns, and a fresh card that still needs a title and a value: it is outlined in warning until it is complete, and the Continue button waits for it.',
      },
    },
  },
};

export const NewMockup: Story = {
  name: 'New · Mockup',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'mockup',
          fresh: { datasets: FRESH_DATASETS, visuals: proposedDrafts() },
        })}
      />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The definition the publish step would write, drawn: KPIs first in their band, the rest in standard tiles. There is no Before view and no inspector, because there is nothing to compare it with.',
      },
    },
  },
};

export const NewMockupOnStandard: Story = {
  name: 'New · Mockup on a standard',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'mockup',
          template: STANDARD_TEMPLATE,
          fresh: { datasets: FRESH_DATASETS, visuals: proposedDrafts() },
        })}
      />
    </Mocked>
  ),
};

export const NewPublish: Story = {
  name: 'New · Publish',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'publish',
          template: STANDARD_TEMPLATE,
          folder: { id: 'fld-sales-eu', name: 'EMEA', path: '/Sales/EMEA' },
          fresh: {
            datasets: FRESH_DATASETS,
            visuals: proposedDrafts(),
            name: 'Regional sales',
            audience: { type: 'dashboard', id: 'exec-summary', name: 'Executive summary' },
          },
        })}
      />
    </Mocked>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Name it, say whose readers it gets, pick a folder. The summary names every dataset, visual and piece of the standard before anything is written.',
      },
    },
  },
};

export const NewCreated: Story = {
  name: 'New · Created',
  render: () => (
    <Mocked routes={authorRoutes()}>
      <AuthorStudioView
        flow={fakeFlow({
          step: 'publish',
          fresh: {
            datasets: FRESH_DATASETS,
            visuals: proposedDrafts(),
            name: 'Regional sales',
          },
          result: {
            assetType: 'dashboard',
            assetId: 'regional-sales-new',
            name: 'Regional sales',
            mode: 'create',
            versionNumber: 1,
            changes: [
              { kind: 'visual', description: 'Added KPI "Revenue": sum of net_revenue' },
              {
                kind: 'visual',
                description:
                  'Added Bar chart "Revenue by region": sum of net_revenue, by region, coloured by channel',
              },
            ],
          },
        })}
      />
    </Mocked>
  ),
};

export const StepPublished: Story = {
  name: '6 · Published',
  render: () => (
    <AuthorStudioView
      flow={fakeFlow({
        step: 'publish',
        draft: resolvedDraft(),
        folder: { id: 'fld-sales-eu', name: 'EMEA', path: '/Sales/EMEA' },
        result: {
          assetType: 'dashboard',
          assetId: 'sales-overview-gold',
          name: 'Sales overview (gold)',
          mode: 'clone',
          versionNumber: 1,
          folderId: 'fld-sales-eu',
          changes: [
            { kind: 'rebind', description: 'Dataset "sales" now reads sales_gold' },
            { kind: 'rename', description: 'Column revenue renamed to net_revenue in "sales"' },
            { kind: 'rename', description: 'Column order_date renamed to Order Date in "sales"' },
            {
              kind: 'visual',
              description: '"Revenue by region" changed from bar chart to line chart',
            },
          ],
        },
      })}
    />
  ),
};
