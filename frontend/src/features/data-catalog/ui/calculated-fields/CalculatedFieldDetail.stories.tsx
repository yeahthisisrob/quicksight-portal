import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../../.storybook/mocks/api';
import { CALCULATED_FIELD_DETAILS, KEYS } from '../__stories__/fieldCatalog';
import { catalogRoutes } from '../__stories__/routes';
import { CalculatedFieldDetail } from './CalculatedFieldDetail';

function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

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
    <Mocked routes={catalogRoutes()}>
      <CalculatedFieldDetail
        detail={CALCULATED_FIELD_DETAILS[KEYS.marginPctDashboard]}
        onOpenField={() => {}}
        onOpenListing={() => {}}
        onClose={() => {}}
      />
    </Mocked>
  ),
};

export const Templated: Story = {
  name: 'margin: templated, noted, read by two fields, used in three assets',
  render: () => (
    <Mocked routes={catalogRoutes()}>
      <CalculatedFieldDetail
        detail={CALCULATED_FIELD_DETAILS[KEYS.margin]}
        onOpenField={() => {}}
        onOpenListing={() => {}}
      />
    </Mocked>
  ),
};

export const Unused: Story = {
  name: 'runway_months: unused, columns not tied to SMUS',
  render: () => (
    <Mocked routes={catalogRoutes()}>
      <CalculatedFieldDetail
        detail={CALCULATED_FIELD_DETAILS[KEYS.runway]}
        onOpenField={() => {}}
        onOpenListing={() => {}}
      />
    </Mocked>
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
