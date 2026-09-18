import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  emptyDefinition,
  freeFormDefinition,
  gridDashboardDefinition,
  paginatedReportDefinition,
  twoSheetAnalysisDefinition,
} from '../lib/__fixtures__/definitions';
import { buildWireframeModel } from '../lib/wireframeModel';
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
