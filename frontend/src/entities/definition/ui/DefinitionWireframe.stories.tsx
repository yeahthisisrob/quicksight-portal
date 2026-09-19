import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  emptyDefinition,
  freeFormDefinition,
  gridDashboardDefinition,
  paginatedReportDefinition,
  twoSheetAnalysisDefinition,
} from '../lib/__fixtures__/definitions';
import { diffWireframeModels, removedOnly } from '../lib/wireframeDiff';
import { buildWireframeModel } from '../lib/wireframeModel';
import type { WireframeModel } from '../model/types';
import { DefinitionWireframe } from './DefinitionWireframe';

/**
 * A read-only sketch of a dashboard or analysis: sheet tabs, the control
 * strip, and every visual as a card with its type and field wells. No data is
 * rendered. The model is a pure projection of the QuickSight Definition, so
 * the same component can preview a cached export or a proposed clone.
 */
const meta: Meta<typeof DefinitionWireframe> = {
  title: 'Entities/Definition/DefinitionWireframe',
  component: DefinitionWireframe,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Box sx={{ p: 2, maxWidth: 1200 }}>
        <Story />
      </Box>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** KPI row, bar, line and table on a 36-column grid, one filter in the control strip. */
export const GridDashboard: Story = {
  args: { model: buildWireframeModel(gridDashboardDefinition) },
};

/** Pixel-positioned elements scaled from a 1200px canvas, including an image and an insight. */
export const FreeFormSheet: Story = {
  args: { model: buildWireframeModel(freeFormDefinition) },
};

/** Two sheets; the second is a pivot and a heat map. */
export const TwoSheetAnalysis: Story = {
  args: { model: buildWireframeModel(twoSheetAnalysisDefinition) },
};

/** Opens on the second sheet. */
export const TwoSheetAnalysisDetailSheet: Story = {
  args: {
    model: buildWireframeModel(twoSheetAnalysisDefinition),
    initialSheetId: 'sheet-pivot',
  },
};

/** Paginated report: header, two body sections and a footer, each its own band. */
export const PaginatedReport: Story = {
  args: { model: buildWireframeModel(paginatedReportDefinition) },
};

/** A definition with no sheets. */
export const Empty: Story = {
  args: { model: buildWireframeModel(emptyDefinition) },
};

const gridModel = buildWireframeModel(gridDashboardDefinition);

/** Health from QuickSight metrics: a slow table and a line chart with load errors. */
export const WithHealthBadges: Story = {
  args: {
    model: gridModel,
    badges: new Map([
      ['table-detail', { kind: 'slow', value: '4.8s', label: 'p90 load time 4.8s (over 3.0s)' }],
      ['line-trend', { kind: 'error', value: '0.9s', label: '7 load errors in the last 14 days' }],
      ['bar-region', { kind: 'timing', value: '1.2s', label: 'p90 load time 1.2s' }],
      ['kpi-revenue', { kind: 'timing', value: '0.3s', label: 'p90 load time 0.3s' }],
    ]),
  },
};

/** Editable: cards are clickable and the selected one is outlined. */
export const Editable: Story = {
  render: function EditableStory() {
    const [selectedId, setSelectedId] = useState<string | undefined>('bar-region');
    return (
      <DefinitionWireframe model={gridModel} selectedId={selectedId} onSelect={setSelectedId} />
    );
  },
};

/** The diff a mockup carries: a retyped bar, a moved KPI, a resized KPI, a removed line, an added table, a renamed field. */
export const WithElementChanges: Story = {
  render: () => {
    const after: WireframeModel = {
      ...gridModel,
      sheets: gridModel.sheets.map((sheet) => ({
        ...sheet,
        elements: [
          ...sheet.elements
            .filter((e) => e.id !== 'line-trend')
            .map((e) => {
              if (e.id === 'bar-region') {
                return {
                  ...e,
                  visualType: 'LineChart',
                  fieldWells: e.fieldWells.map((w) =>
                    w.role === 'Values'
                      ? { ...w, fields: w.fields.map((f) => ({ ...f, label: 'net_revenue' })) }
                      : w
                  ),
                };
              }
              if (e.id === 'kpi-orders' && e.position.type === 'grid') {
                return { ...e, position: { ...e.position, col: 27 } };
              }
              if (e.id === 'kpi-revenue' && e.position.type === 'grid') {
                return { ...e, position: { ...e.position, colSpan: 18 } };
              }
              return e;
            }),
          {
            ...sheet.elements.find((e) => e.id === 'table-detail')!,
            id: 'table-detail-copy',
            title: 'Top customers (EMEA)',
            position: { type: 'grid', col: 0, row: 22, colSpan: 36, rowSpan: 8 },
          },
        ],
      })),
    };
    return <DefinitionWireframe model={after} diff={diffWireframeModels(gridModel, after)} />;
  },
};

/** The same diff on the "before" side: only the removed element, drawn as a ghost. */
export const RemovedGhosts: Story = {
  render: () => {
    const after: WireframeModel = {
      ...gridModel,
      sheets: gridModel.sheets.map((sheet) => ({
        ...sheet,
        elements: sheet.elements.filter((e) => e.id !== 'line-trend'),
      })),
    };
    return (
      <DefinitionWireframe
        model={gridModel}
        diff={removedOnly(diffWireframeModels(gridModel, after))}
      />
    );
  },
};

/** A sheet whose layout QuickSight did not return: cards flow in definition order. */
export const NoLayoutFallback: Story = {
  args: {
    model: buildWireframeModel({
      Sheets: [
        {
          SheetId: 's1',
          Name: 'Unlaid',
          Visuals: gridDashboardDefinition.Sheets[0].Visuals,
        },
      ],
    }),
    hideSummary: true,
  },
};
