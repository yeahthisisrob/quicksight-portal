import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi, requestBody } from '../../../../../.storybook/mocks/api';
import RebindDialog from './RebindDialog';

/**
 * The dialog makes three kinds of request: the definition's datasets on open,
 * a dataset search for the picker, and a plan every time a target or a rename
 * changes. Each story stubs those at the HTTP layer and lets the real dialog
 * logic run, so what you see is what a user gets.
 */

const SILVER_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/orders-silver';
const GOLD_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/orders-gold';

const usage = (partial: Partial<Record<string, number>> = {}) => ({
  visual: 0,
  filter: 0,
  calculatedField: 0,
  parameter: 0,
  control: 0,
  other: 0,
  ...partial,
});

const DATASETS = [
  {
    identifier: 'orders',
    dataSetArn: SILVER_ARN,
    dataSetId: 'orders-silver',
    columns: [
      { name: 'cost', usage: usage({ calculatedField: 1 }) },
      { name: 'order_date', usage: usage({ visual: 1 }) },
      { name: 'revenue', usage: usage({ visual: 1, calculatedField: 2, other: 1 }) },
      { name: 'status', usage: usage({ visual: 1, filter: 1 }) },
    ],
    calculatedFields: ['margin', 'margin_pct'],
  },
];

const GOLD = [
  { name: 'status', type: 'STRING' },
  { name: 'net_revenue', type: 'DECIMAL' },
  { name: 'cost', type: 'DECIMAL' },
  { name: 'Order Date', type: 'DATETIME' },
  { name: 'customer_id', type: 'STRING' },
];

const SEARCH_RESULTS = [
  { id: 'orders-gold', name: 'orders_gold' },
  { id: 'orders-bronze', name: 'orders_bronze' },
  { id: 'customers', name: 'customers' },
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A faithful copy of the server's resolution rules, so the story reacts like the app. */
function planFor(
  rebinds: Array<{
    identifier: string;
    targetDataSetId: string;
    columnMap?: Record<string, string>;
  }>
) {
  const datasets = rebinds.map((rebind) => {
    const source = DATASETS.find((d) => d.identifier === rebind.identifier)!;
    const map = rebind.columnMap ?? {};
    const used = new Set<string>();
    const columns = source.columns.map((column) => {
      const mapped = map[column.name];
      if (mapped !== undefined) {
        const hit = GOLD.find((g) => g.name === mapped);
        if (hit) {
          used.add(hit.name);
          return {
            ...column,
            status: 'mapped' as const,
            resolvedTo: hit.name,
            targetType: hit.type,
          };
        }
        return { ...column, status: 'missing' as const };
      }
      const exact = GOLD.find((g) => g.name === column.name);
      if (exact) {
        used.add(exact.name);
        return {
          ...column,
          status: 'matched' as const,
          resolvedTo: exact.name,
          targetType: exact.type,
        };
      }
      const near = GOLD.filter((g) => normalize(g.name) === normalize(column.name));
      if (near.length === 1) {
        return {
          ...column,
          status: 'suggested' as const,
          suggestion: near[0]!.name,
          targetType: near[0]!.type,
        };
      }
      return { ...column, status: 'missing' as const };
    });
    const summary = { matched: 0, mapped: 0, suggested: 0, missing: 0 };
    for (const c of columns) {
      summary[c.status] += 1;
    }
    return {
      identifier: rebind.identifier,
      current: { dataSetId: source.dataSetId, dataSetArn: source.dataSetArn },
      target: {
        dataSetId: rebind.targetDataSetId,
        dataSetArn: GOLD_ARN,
        name: 'orders_gold',
        columnCount: GOLD.length,
      },
      columns,
      unusedTargetColumns: GOLD.map((g) => g.name).filter((n) => !used.has(n)),
      summary,
    };
  });
  return {
    assetType: 'dashboard',
    assetId: 'd1',
    name: 'Sales overview',
    datasets,
    canApply: datasets.every((d) => d.summary.suggested === 0 && d.summary.missing === 0),
  };
}

const routes = (overrides: MockRoute[] = []): MockRoute[] => [
  ...overrides,
  {
    method: 'get',
    url: /\/authoring\/.*\/datasets$/,
    respond: () => ({
      body: {
        success: true,
        data: { assetType: 'dashboard', assetId: 'd1', name: 'Sales overview', datasets: DATASETS },
      },
    }),
  },
  {
    method: 'get',
    url: '/assets/datasets/paginated',
    respond: (config) => {
      const search = String(config.params?.search ?? '').toLowerCase();
      return {
        body: {
          success: true,
          data: {
            datasets: SEARCH_RESULTS.filter((d) => d.name.includes(search)),
            pagination: { page: 1, pageSize: 25, totalItems: 3, totalPages: 1 },
          },
        },
      };
    },
  },
  {
    method: 'post',
    url: '/rebind/plan',
    respond: (config) => ({ body: { success: true, data: planFor(requestBody(config).rebinds) } }),
  },
  {
    method: 'post',
    url: /\/rebind$/,
    respond: (config) => {
      const { mode, name } = requestBody(config);
      return {
        body: {
          success: true,
          data: {
            assetType: 'dashboard',
            assetId: mode === 'clone' ? 'new-id' : 'd1',
            name,
            arn: 'arn:x',
            mode,
            versionNumber: 2,
            plan: planFor(requestBody(config).rebinds),
          },
        },
      };
    },
  },
];

/**
 * Installs the stub during render, not in an effect: the dialog is a child,
 * and children's effects run before the parent's, so an effect here would
 * install the adapter after the dialog had already fired its first request.
 */
function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta: Meta<typeof RebindDialog> = {
  title: 'Features/AssetManagement/RebindDialog',
  component: RebindDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Points a dashboard or analysis at different datasets, in place or as a copy. Every change re-runs the server dry run; apply is only enabled when every column resolves.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const args = {
  open: true,
  onClose: () => {},
  assetType: 'dashboard' as const,
  asset: { id: 'd1', name: 'Sales overview' },
};

/** Fresh open: pick a target dataset for each identifier the definition declares. */
export const ChooseTarget: Story = {
  args,
  render: (a) => (
    <Mocked routes={routes()}>
      <RebindDialog {...a} />
    </Mocked>
  ),
};

/** Same, for an analysis. */
export const Analysis: Story = {
  args: { ...args, assetType: 'analysis', asset: { id: 'a1', name: 'Sales analysis' } },
  render: (a) => (
    <Mocked routes={routes()}>
      <RebindDialog {...a} />
    </Mocked>
  ),
};

/** The definition cannot be read (for example a dashboard whose definition has errors). */
export const CannotRead: Story = {
  args,
  render: (a) => (
    <Mocked
      routes={routes([
        {
          method: 'get',
          url: /\/authoring\/.*\/datasets$/,
          respond: () => ({
            status: 400,
            body: {
              success: false,
              error: "Could not load the dashboard definition from QuickSight for 'd1'",
            },
          }),
        },
      ])}
    >
      <RebindDialog {...a} />
    </Mocked>
  ),
};

/** QuickSight rejects the write; its message is shown verbatim. */
export const RejectedByQuickSight: Story = {
  args,
  render: (a) => (
    <Mocked
      routes={routes([
        {
          method: 'post',
          url: /\/rebind$/,
          respond: () => ({
            status: 400,
            body: {
              success: false,
              error:
                'Column net_revenue in dataset orders has type DECIMAL but the visual expects DATETIME',
            },
          }),
        },
      ])}
    >
      <RebindDialog {...a} />
    </Mocked>
  ),
};
