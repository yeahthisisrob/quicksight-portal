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

/** A field everywhere: sixty assets define it and four variants disagree, and it stays one screen. */
export const AtScale: Story = {
  name: 'active_status: defined in 60 assets, four variants',
  render: () => {
    const base = CALCULATED_FIELD_DETAILS[KEYS.margin]!;
    const assets = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({
        type: i % 3 === 0 ? ('dataset' as const) : ('analysis' as const),
        id: `${prefix}-${i}`,
        name: `${prefix} ${i + 1}`,
      }));
    const long = `ifelse(\n  {status} = 'A', 'Active',\n  {status} = 'P', 'Pending',\n  {status} = 'S', 'Suspended',\n  {status} = 'C', 'Closed',\n  {status} = 'X', 'Cancelled',\n  {status} = 'R', 'Reopened',\n  'Unknown'\n)`;
    const detail = {
      ...base,
      name: 'active_status',
      expression: long,
      definedIn: assets(60, 'Orders'),
      variants: [
        { key: base.key, expression: long, definedIn: assets(60, 'Orders') },
        {
          key: 'cf_v2',
          expression: "ifelse({status} = 'A', 1, 0)",
          definedIn: assets(12, 'Pipeline'),
        },
        { key: 'cf_v3', expression: "{status} = 'A'", definedIn: assets(3, 'Legacy') },
        { key: 'cf_v4', expression: "in({status}, ['A', 'R'])", definedIn: assets(1, 'Ops') },
      ],
      conflict: { variants: 3 },
    };
    return (
      <MockedApi routes={catalogRoutes()}>
        <CalculatedFieldDetail
          detail={detail as never}
          onOpenField={() => {}}
          onOpenListing={() => {}}
        />
      </MockedApi>
    );
  },
};
