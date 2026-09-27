import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../../.storybook/mocks/api';
import { authorRoutes } from '../__stories__/fixtures';
import { FieldTrace } from './FieldTrace';

/**
 * A column's lineage from the context graph: the governed column it was
 * renamed from, and the calculated field and visuals a change would touch.
 */
const meta: Meta<typeof FieldTrace> = {
  title: 'Features/Author/Field trace',
  component: FieldTrace,
  args: { entityId: 'dataset-column:sales-gold/revenue' },
  render: (args) => (
    <MockedApi routes={authorRoutes()}>
      <FieldTrace {...args} />
    </MockedApi>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Column: Story = {};
