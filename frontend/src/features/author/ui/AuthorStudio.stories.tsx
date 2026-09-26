import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { MockRoute } from '../../../../.storybook/mocks/api';
import { MockedApi } from '../../../../.storybook/mocks/api';
import { authorRoutes, EDITOR_OPS, fakeStudio, REPAIR_PLAN } from './__stories__/fixtures';
import { AuthorStudioView, type StudioView } from './AuthorStudio';
import { AssetBrowser } from './editor/AssetBrowser';
import { SaveDialog } from './editor/SaveDialog';

/**
 * Each story hands `AuthorStudioView` a canned studio so each view and
 * panel can be looked at in a known state. The real hook, clicked through,
 * is covered by the Pages/Author stories.
 */

const meta: Meta<typeof AuthorStudioView> = {
  title: 'Features/Author/Studio',
  component: AuthorStudioView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Studio edits and fixes what exists, by function rather than by steps: the Editor (issues and their fixes, the canvas, the inspector, the datasets and their SMUS governance, usage; save over it or as a copy), the Templates everything reuses, and account-wide Scripts. New assets come from the Assistant.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A demo-cleanup preview, so the Scripts view has something to show. */
const DEMO_CLEANUP: MockRoute = {
  method: 'get',
  url: '/scripts/demo-cleanup/preview',
  respond: () => ({
    body: {
      success: true,
      data: {
        datasources: [{ id: 'ds-sample', name: 'Sample data', bucket: 'spaceneedle-samplefiles' }],
        datasets: [
          { id: 'people', name: 'People Overview' },
          { id: 'sales-pipeline', name: 'Sales Pipeline' },
        ],
        analyses: [{ id: 'business-review', name: 'Business Review' }],
      },
    },
  }),
};

function view(studio: ReturnType<typeof fakeStudio>, current: StudioView = 'editor') {
  return (
    <MockedApi routes={authorRoutes([DEMO_CLEANUP])}>
      <AuthorStudioView studio={studio} view={current} onViewChange={() => {}} />
    </MockedApi>
  );
}

// --- editor -------------------------------------------------------------------

export const Browse: Story = {
  name: 'Editor · open something (errors first)',
  render: () => view(fakeStudio({ closed: true })),
  parameters: {
    docs: {
      description: {
        story:
          'Nothing open: what needs fixing comes first (Marketing funnel has two definition errors), then templates, then the most viewed. A click opens it.',
      },
    },
  },
};

export const BrowseSearch: Story = {
  name: 'Editor · open something, searched',
  render: () => (
    <MockedApi routes={authorRoutes()}>
      <Box sx={{ p: 3, maxWidth: 960 }}>
        <AssetBrowser onOpen={() => {}} initialSearch="sales revenue" />
      </Box>
    </MockedApi>
  ),
};

export const Issues: Story = {
  name: 'Editor · Issues',
  render: () => view(fakeStudio({ repairPlan: REPAIR_PLAN })),
  parameters: {
    docs: {
      description: {
        story:
          'Every kind of issue with its proposed fix, already applied to the canvas until you choose otherwise ("Fix all" takes back any "leave as is"), and the slow or failing visuals from CloudWatch below: a click selects one on the canvas.',
      },
    },
  },
};

export const Inspect: Story = {
  name: 'Editor · Inspect a visual',
  render: () =>
    view(
      fakeStudio({
        panel: 'inspect',
        ops: EDITOR_OPS.slice(0, 2),
        selectedElement: { sheetId: 'sheet-overview', elementId: 'bar-region' },
      })
    ),
  parameters: {
    docs: {
      description: {
        story:
          'The bar chart is selected: the inspector shows its title, type, position and size. It has been retitled and retyped, so the canvas carries the change.',
      },
    },
  },
};

export const Changes: Story = {
  name: 'Editor · Changes',
  render: () => view(fakeStudio({ panel: 'changes', ops: EDITOR_OPS })),
  parameters: {
    docs: {
      description: {
        story:
          'A retitle, a retype, a move, a resize, a removal, a duplicate and a sheet rename: each edit can be taken back, and the list below says what a save writes.',
      },
    },
  },
};

export const Data: Story = {
  name: 'Editor · Data and usage, with SMUS',
  render: () => view(fakeStudio({ panel: 'data' })),
  parameters: {
    docs: {
      description: {
        story:
          'The datasets the dashboard reads: targets is governed by a SMUS asset, sales is not, and the Assistant is one click away to move it.',
      },
    },
  },
};

export const DataWithoutSmus: Story = {
  name: 'Editor · Data, SMUS not configured',
  render: () => view(fakeStudio({ panel: 'data', smus: false })),
};

export const NotCached: Story = {
  name: 'Editor · no cached definition',
  render: () => view(fakeStudio({ noDefinition: true, repairPlan: REPAIR_PLAN })),
};

export const Save: Story = {
  name: 'Editor · Save',
  render: () => (
    <MockedApi routes={authorRoutes()}>
      <SaveDialog studio={fakeStudio({ ops: EDITOR_OPS.slice(0, 3) })} open onClose={() => {}} />
    </MockedApi>
  ),
};

export const SaveRejected: Story = {
  name: 'Editor · Save, rejected by QuickSight',
  render: () => (
    <MockedApi routes={authorRoutes()}>
      <SaveDialog
        studio={fakeStudio({
          ops: EDITOR_OPS.slice(0, 1),
          saveError:
            'Column net_revenue in dataset sales has type DECIMAL but the visual expects DATETIME',
        })}
        open
        onClose={() => {}}
      />
    </MockedApi>
  ),
};

export const Saved: Story = {
  name: 'Editor · Saved as a copy',
  render: () => (
    <MockedApi routes={authorRoutes()}>
      <SaveDialog
        studio={fakeStudio({
          result: {
            assetType: 'dashboard',
            assetId: 'sales-overview-copy',
            name: 'Sales overview (EMEA)',
            mode: 'clone',
            versionNumber: 1,
            folderIds: ['fld-sales-eu'],
            changes: [
              {
                kind: 'visual',
                description: '"Revenue by region" changed from bar chart to line chart',
              },
              { kind: 'layout', description: 'Moved "Orders" to column 0, row 6' },
            ],
          },
        })}
        open
        onClose={() => {}}
      />
    </MockedApi>
  ),
};

// --- templates and scripts -------------------------------------------------------

export const Templates: Story = {
  name: 'Templates',
  render: () => view(fakeStudio({ closed: true }), 'templates'),
  parameters: {
    docs: {
      description: {
        story:
          'The naming standard (c_ in analyses and dashboards, c_ds_ in datasets), the filter bars, visuals, calculated fields and layouts everything reuses.',
      },
    },
  },
};

export const Scripts: Story = {
  name: 'Scripts',
  render: () => view(fakeStudio({ closed: true }), 'scripts'),
};
