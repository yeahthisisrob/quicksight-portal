import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../../.storybook/mocks/api';
import { CALCULATED_FIELD_DETAILS, KEYS } from '../__stories__/fieldCatalog';
import { catalogRoutes } from '../__stories__/routes';
import { CalculatedFieldDetail } from './CalculatedFieldDetail';

const meta: Meta = {
  title: 'Features/Data Catalog/CalculatedFieldDetail',
  component: CalculatedFieldDetail,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One calculated field: the expression pretty-printed, what it reads (with the SMUS column behind each), what reads it, where it is used down to the visual, and every variant under the same name side by side.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 880 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithVariants: Story = {
  name: 'margin_pct: three variants, reads a calculated field and a SMUS column',
  render: () => (
    <MockedApi routes={catalogRoutes()}>
      <CalculatedFieldDetail
        detail={CALCULATED_FIELD_DETAILS[KEYS.marginPctDashboard]}
        onOpenField={() => {}}
        onOpenListing={() => {}}
        onClose={() => {}}
      />
    </MockedApi>
  ),
};

export const Templated: Story = {
  name: 'margin: templated, noted, read by two fields, used in three assets',
  render: () => (
    <MockedApi routes={catalogRoutes()}>
      <CalculatedFieldDetail
        detail={CALCULATED_FIELD_DETAILS[KEYS.margin]}
        onOpenField={() => {}}
        onOpenListing={() => {}}
      />
    </MockedApi>
  ),
};

export const Loading: Story = {
  render: () => <CalculatedFieldDetail loading onOpenField={() => {}} onOpenListing={() => {}} />,
};

export const NothingPicked: Story = {
  render: () => <CalculatedFieldDetail onOpenField={() => {}} onOpenListing={() => {}} />,
};

export const LoadError: Story = {
  render: () => (
    <CalculatedFieldDetail
      error="No calculated field 'cf_gone'"
      onOpenField={() => {}}
      onOpenListing={() => {}}
    />
  ),
};
