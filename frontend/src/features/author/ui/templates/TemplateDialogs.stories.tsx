import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../../.storybook/mocks/api';
import {
  FILTER_BARS,
  templateLibraryRoutes,
  VISUAL_TEMPLATES,
} from '../../../../../.storybook/mocks/templates';
import { FilterBarDialog } from './FilterBarDialog';
import { VisualTemplateDialog } from './VisualTemplateDialog';

/** The editors behind the Studio's Templates view, open on a saved template. */
const meta: Meta = {
  title: 'Features/Author/Templates',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Editing a filter bar: controls in order with widths, previewed as the bar. */
export const FilterBarEditor: Story = {
  render: () => (
    <MockedApi routes={templateLibraryRoutes()}>
      <FilterBarDialog open onClose={() => {}} template={FILTER_BARS[0] as never} />
    </MockedApi>
  ),
};

/** Editing a visual template: type, category, values and aggregations, summarised as what it draws. */
export const VisualTemplateEditor: Story = {
  render: () => (
    <MockedApi routes={templateLibraryRoutes()}>
      <VisualTemplateDialog open onClose={() => {}} template={VISUAL_TEMPLATES[1] as never} />
    </MockedApi>
  ),
};
