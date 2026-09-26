import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DefinitionDataset, RebindPlan } from '../../../types';
import type { PlannerModel, StructuredRequest, StructuredResult } from '../PlannerModel';
import { PlannerService, parseChoice, parseEditOps, parseMappings } from '../PlannerService';

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../../shared/services/cache/CacheService', () => ({
  cacheService: { getCacheEntries: vi.fn() },
}));

const usage = () => ({
  visual: 0,
  filter: 0,
  calculatedField: 0,
  parameter: 0,
  control: 0,
  other: 0,
});

const DATASETS: DefinitionDataset[] = [
  {
    identifier: 'orders',
    dataSetArn: 'arn:x/orders-silver',
    dataSetId: 'orders-silver',
    columns: [
      { name: 'revenue', usage: usage() },
      { name: 'order_date', usage: usage() },
    ],
    calculatedFields: [],
  },
];

const CANDIDATES = [
  { id: 'orders-gold', name: 'orders_gold' },
  { id: 'customers', name: 'customers' },
];

/** A plan where order_date is only suggested and revenue is missing. */
const planFor = (columnMap: Record<string, string> = {}): RebindPlan => {
  const resolved = (name: string) =>
    columnMap[name]
      ? { name, status: 'mapped' as const, resolvedTo: columnMap[name], usage: usage() }
      : name === 'order_date'
        ? { name, status: 'suggested' as const, suggestion: 'Order Date', usage: usage() }
        : { name, status: 'missing' as const, usage: usage() };
  const columns = [resolved('revenue'), resolved('order_date')];
  const summary = { matched: 0, mapped: 0, suggested: 0, missing: 0 };
  for (const c of columns) {
    summary[c.status] += 1;
  }
  return {
    assetType: 'dashboard',
    assetId: 'd1',
    name: 'Sales',
    datasets: [
      {
        identifier: 'orders',
        current: { dataSetId: 'orders-silver', dataSetArn: 'arn:x/orders-silver' },
        target: {
          dataSetId: 'orders-gold',
          dataSetArn: 'arn:x/orders-gold',
          name: 'orders_gold',
          columnCount: 3,
        },
        columns,
        unusedTargetColumns: ['net_revenue', 'Order Date', 'customer_id'].filter(
          (c) => !Object.values(columnMap).includes(c)
        ),
        summary,
      },
    ],
    canApply: summary.missing === 0 && summary.suggested === 0,
  };
};

class FakeModel implements PlannerModel {
  public readonly provider = 'fake';
  public readonly requests: StructuredRequest[] = [];
  public constructor(private readonly answers: unknown[]) {}
  public async complete(request: StructuredRequest): Promise<StructuredResult> {
    this.requests.push(request);
    const output = this.answers.shift();
    return await Promise.resolve({ output, provider: this.provider, model: 'fake-1' });
  }
}

describe('PlannerService', () => {
  const rebindService = {
    describeDatasets: vi.fn(),
    plan: vi.fn(),
  };
  const loadCandidates = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rebindService.describeDatasets.mockResolvedValue({
      assetType: 'dashboard',
      assetId: 'd1',
      name: 'Sales',
      datasets: DATASETS,
    });
    rebindService.plan.mockImplementation(async (_t: string, _id: string, rebinds: any[]) =>
      planFor(rebinds[0]?.columnMap ?? {})
    );
    loadCandidates.mockResolvedValue(CANDIDATES);
  });

  const service = (answers: unknown[]) =>
    new PlannerService(rebindService as any, new FakeModel(answers), loadCandidates);

  it('asks which dataset, then only the unresolved columns, and re-plans with the answer', async () => {
    const model = new FakeModel([
      {
        intent: 'rebind',
        mode: 'clone',
        name: 'Sales (gold)',
        reason: 'The ask names the gold dataset',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', reason: 'named' }],
      },
      {
        mappings: [
          {
            identifier: 'orders',
            source: 'revenue',
            target: 'net_revenue',
            reason: 'same measure',
          },
          {
            identifier: 'orders',
            source: 'order_date',
            target: 'Order Date',
            reason: 'same field',
          },
        ],
      },
    ]);
    const planner = new PlannerService(rebindService as any, model, loadCandidates);

    const proposal = await planner.propose('dashboard', 'd1', {
      ask: 'copy this onto orders_gold',
    });

    expect(model.requests.map((r) => r.label)).toEqual(['choose-target', 'map-columns']);
    // The first question sees the candidates and the columns in use
    expect(model.requests[0]?.user).toContain('"orders-gold"');
    expect(model.requests[0]?.user).toContain('"order_date"');
    // The second sees only what the dry run could not resolve, and the target's spare columns
    expect(model.requests[1]?.user).toContain('"suggestion":"Order Date"');
    expect(model.requests[1]?.user).toContain('"net_revenue"');

    expect(rebindService.plan).toHaveBeenCalledTimes(2);
    expect(rebindService.plan).toHaveBeenLastCalledWith('dashboard', 'd1', [
      {
        identifier: 'orders',
        targetDataSetId: 'orders-gold',
        reason: 'named',
        columnMap: { revenue: 'net_revenue', order_date: 'Order Date' },
      },
    ]);
    expect(proposal).toMatchObject({
      intent: 'rebind',
      mode: 'clone',
      name: 'Sales (gold)',
      unmapped: [],
      model: { provider: 'fake' },
    });
    expect(proposal.plan?.canApply).toBe(true);
  });

  it('skips the mapping question when the dry run already resolves everything', async () => {
    rebindService.plan.mockResolvedValue({ ...planFor(), canApply: true });
    const planner = service([
      {
        intent: 'rebind',
        mode: 'update',
        name: '',
        reason: 'r',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', reason: '' }],
      },
    ]);

    const proposal = await planner.propose('dashboard', 'd1', { ask: 'switch in place' });

    expect(rebindService.plan).toHaveBeenCalledTimes(1);
    expect(proposal.mode).toBe('update');
    expect(proposal.name).toBeUndefined();
  });

  it('reports columns the model could not or did not map, and keeps the plan honest', async () => {
    const planner = service([
      {
        intent: 'rebind',
        mode: 'clone',
        name: '',
        reason: 'r',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', reason: '' }],
      },
      {
        mappings: [
          { identifier: 'orders', source: 'revenue', target: '', reason: 'nothing means revenue' },
        ],
      },
    ]);

    const proposal = await planner.propose('dashboard', 'd1', { ask: 'copy onto gold' });

    expect(proposal.unmapped).toEqual([
      { identifier: 'orders', column: 'revenue', reason: 'nothing means revenue' },
      {
        identifier: 'orders',
        column: 'order_date',
        reason: 'The planner gave no answer for this column',
      },
    ]);
    expect(proposal.plan?.canApply).toBe(false);
    expect(proposal.name).toBe('Sales (copy)');
  });

  it('returns an unclear proposal without planning', async () => {
    const planner = service([
      {
        intent: 'unclear',
        mode: 'clone',
        name: '',
        reason: 'This asks about permissions',
        rebinds: [],
      },
    ]);

    const proposal = await planner.propose('dashboard', 'd1', { ask: 'who can see this?' });

    expect(proposal).toMatchObject({ intent: 'unclear', plan: null, rebinds: [] });
    expect(rebindService.plan).not.toHaveBeenCalled();
  });

  it('refuses a dataset the model made up', async () => {
    const planner = service([
      {
        intent: 'rebind',
        mode: 'clone',
        name: '',
        reason: '',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'made-up', reason: '' }],
      },
    ]);
    await expect(planner.propose('dashboard', 'd1', { ask: 'x' })).rejects.toThrow(
      'not a candidate'
    );
  });

  it('refuses a column mapping to something the target lacks', async () => {
    const planner = service([
      {
        intent: 'rebind',
        mode: 'clone',
        name: '',
        reason: '',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', reason: '' }],
      },
      { mappings: [{ identifier: 'orders', source: 'revenue', target: 'gross', reason: '' }] },
    ]);
    await expect(planner.propose('dashboard', 'd1', { ask: 'x' })).rejects.toThrow(
      "'gross', which the target dataset does not have"
    );
  });

  it('restricts candidates when asked and rejects an empty ask', async () => {
    const model = new FakeModel([
      { intent: 'unclear', mode: 'clone', name: '', reason: '', rebinds: [] },
    ]);
    const planner = new PlannerService(rebindService as any, model, loadCandidates);

    await planner.propose('dashboard', 'd1', {
      ask: 'anything',
      candidateDataSetIds: ['customers'],
    });
    expect(model.requests[0]?.user).toContain('"customers"');
    expect(model.requests[0]?.user).not.toContain('"orders-gold"');

    await expect(planner.propose('dashboard', 'd1', { ask: '   ' })).rejects.toThrow(
      'Say what you want'
    );
  });
});

describe('parseChoice', () => {
  const ids = new Set(['orders']);
  const candidates = new Set(['orders-gold']);

  it('defaults unknown intent/mode and trims strings', () => {
    expect(
      parseChoice(
        { intent: 'weird', mode: 'nope', name: ' x ', reason: '', rebinds: [] },
        ids,
        candidates
      )
    ).toEqual({
      intent: 'rebind',
      mode: 'clone',
      name: 'x',
      reason: '',
      rebinds: [],
      wantsEdits: false,
    });
  });

  it('drops a duplicated identifier and non-object entries', () => {
    const choice = parseChoice(
      {
        intent: 'rebind',
        mode: 'update',
        name: '',
        reason: '',
        rebinds: [
          { identifier: 'orders', targetDataSetId: 'orders-gold', reason: 'a' },
          { identifier: 'orders', targetDataSetId: 'orders-gold', reason: 'b' },
          'junk',
        ],
      },
      ids,
      candidates
    );
    expect(choice.rebinds).toEqual([
      { identifier: 'orders', targetDataSetId: 'orders-gold', reason: 'a' },
    ]);
  });

  it('rejects a non-object answer and an undeclared identifier', () => {
    expect(() => parseChoice('nope', ids, candidates)).toThrow('not an object');
    expect(() =>
      parseChoice(
        { rebinds: [{ identifier: 'ghost', targetDataSetId: 'orders-gold' }] },
        ids,
        candidates
      )
    ).toThrow("'ghost'");
  });
});

describe('parseMappings', () => {
  const unresolved = [
    {
      identifier: 'orders',
      unresolved: [{ source: 'revenue' }],
      availableTargetColumns: ['net_revenue'],
    },
  ];

  it('ignores answers about columns that were not asked about', () => {
    const mappings = parseMappings(
      { mappings: [{ identifier: 'orders', source: 'status', target: 'net_revenue', reason: '' }] },
      unresolved
    );
    expect(mappings).toEqual([
      {
        identifier: 'orders',
        source: 'revenue',
        target: '',
        reason: 'The planner gave no answer for this column',
      },
    ]);
  });

  it('rejects an answer with no mappings array', () => {
    expect(() => parseMappings({}, unresolved)).toThrow('no column mappings');
  });
});

describe('parseEditOps', () => {
  const outline = [
    {
      sheetId: 's1',
      name: 'Overview',
      layout: 'grid' as const,
      elements: [{ elementId: 'v1', kind: 'visual' as const }],
    },
  ];

  it('turns the flat answer into typed ops and drops what it cannot use', () => {
    const ops = parseEditOps(
      {
        reason: 'x',
        ops: [
          {
            op: 'move',
            sheetId: 's1',
            elementId: 'v1',
            col: 18,
            row: 0,
            colSpan: -1,
            rowSpan: -1,
            visualType: '',
            title: '',
            name: '',
          },
          {
            op: 'retype',
            sheetId: 's1',
            elementId: 'v1',
            col: -1,
            row: -1,
            colSpan: -1,
            rowSpan: -1,
            visualType: 'LineChart',
            title: '',
            name: '',
          },
          {
            op: 'renameSheet',
            sheetId: 's1',
            elementId: '',
            col: -1,
            row: -1,
            colSpan: -1,
            rowSpan: -1,
            visualType: '',
            title: '',
            name: 'Sales',
          },
          { op: 'move', sheetId: 'ghost', elementId: 'v1', col: 0, row: 0 },
          { op: 'explode', sheetId: 's1', elementId: 'v1' },
          { op: 'resize', sheetId: 's1', elementId: '', colSpan: 3, rowSpan: 3 },
        ],
      },
      outline
    );
    expect(ops).toEqual([
      { op: 'move', sheetId: 's1', elementId: 'v1', col: 18, row: 0 },
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'LineChart' },
      { op: 'renameSheet', sheetId: 's1', name: 'Sales' },
    ]);
  });

  it('returns nothing for a malformed answer', () => {
    expect(parseEditOps('nope', outline)).toEqual([]);
    expect(parseEditOps({ ops: 'x' }, outline)).toEqual([]);
  });
});

describe('PlannerService edits', () => {
  it('asks for edits when the ask wants them, validates each op against a preview, and keeps only what applies', async () => {
    const rebindService = {
      describeDatasets: vi.fn().mockResolvedValue({
        assetType: 'dashboard',
        assetId: 'd1',
        name: 'Sales',
        datasets: DATASETS,
      }),
      plan: vi.fn(),
      describeTargetDataset: vi.fn().mockResolvedValue({
        columns: [
          { name: 'region', type: 'STRING' },
          { name: 'revenue', type: 'DECIMAL' },
        ],
      }),
      loadDefinitionOutline: vi.fn().mockResolvedValue([
        {
          sheetId: 's1',
          name: 'Overview',
          layout: 'grid',
          elements: [{ elementId: 'v1', kind: 'visual', visualType: 'BarChart' }],
        },
      ]),
      preview: vi.fn().mockResolvedValue({
        plan: planFor(),
        definition: {
          Sheets: [
            {
              SheetId: 's1',
              Name: 'Overview',
              Visuals: [
                {
                  BarChartVisual: {
                    VisualId: 'v1',
                    ChartConfiguration: { FieldWells: { BarChartAggregatedFieldWells: {} } },
                  },
                },
              ],
              Layouts: [
                {
                  Configuration: {
                    GridLayout: {
                      Elements: [
                        {
                          ElementId: 'v1',
                          ElementType: 'VISUAL',
                          ColumnIndex: 0,
                          ColumnSpan: 18,
                          RowIndex: 0,
                          RowSpan: 12,
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
        changes: [],
        outline: [],
      }),
    };
    const model = new FakeModel([
      { intent: 'rebind', mode: 'clone', name: '', reason: 'r', wantsEdits: true, rebinds: [] },
      {
        reason: 'move and retype',
        ops: [
          {
            op: 'retype',
            sheetId: 's1',
            elementId: 'v1',
            col: -1,
            row: -1,
            colSpan: -1,
            rowSpan: -1,
            visualType: 'LineChart',
            title: '',
            name: '',
          },
          {
            op: 'move',
            sheetId: 's1',
            elementId: 'v1',
            col: 30,
            row: 0,
            colSpan: -1,
            rowSpan: -1,
            visualType: '',
            title: '',
            name: '',
          },
        ],
      },
    ]);
    const planner = new PlannerService(
      rebindService as any,
      model,
      vi.fn().mockResolvedValue(CANDIDATES)
    );

    const proposal = await planner.propose('dashboard', 'd1', { ask: 'make the bar a line' });

    expect(model.requests.map((r) => r.label)).toEqual(['choose-target', 'plan-edits']);
    expect(model.requests[1]?.user).toContain('"elementId":"v1"');
    // Every column of the dataset, typed, so added visuals and filters can use any of them.
    expect(model.requests[1]?.user).toContain('revenue (DECIMAL)');
    expect(model.requests[1]?.user).toContain('action filter');
    // The retype applies; the move would leave the 36-column grid, and says so.
    expect(proposal.ops).toEqual([
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'LineChart' },
    ]);
    expect(proposal.problems).toEqual([expect.stringMatching(/^move: .*36-column grid/)]);
    expect(proposal.intent).toBe('rebind');
    expect(proposal.plan).toBeNull();
  });

  it("adds the organisation's guidance to the prompts it applies to, and nothing when there is none", async () => {
    const answer = {
      intent: 'rebind',
      mode: 'clone',
      name: 'Sales (gold)',
      reason: 'named',
      rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', reason: 'named' }],
    };
    const rebindService = {
      describeDatasets: vi.fn().mockResolvedValue({
        assetType: 'dashboard',
        assetId: 'd1',
        name: 'Sales',
        datasets: DATASETS,
      }),
      plan: vi.fn(async (_t: string, _id: string, rebinds: any[]) =>
        planFor(rebinds[0]?.columnMap ?? {})
      ),
    };
    const loadCandidates = vi.fn().mockResolvedValue(CANDIDATES);
    const guided = new FakeModel([answer, { mappings: [] }]);
    await new PlannerService(rebindService as any, guided, loadCandidates, {
      guidance: {
        fieldStrategy: 'source',
        architecture: 'Medallion: bronze, silver, gold in Glue.',
        datasets: 'Prefer SPICE datasets over gold tables.',
        explorations: '',
        visuals: 'Never use pie charts.',
      },
    }).propose('dashboard', 'd1', { ask: 'copy this onto orders_gold' });
    const chooseSystem = guided.requests[0]?.system ?? '';
    expect(chooseSystem).toContain('Medallion: bronze, silver, gold in Glue.');
    expect(chooseSystem).toContain('Prefer SPICE datasets over gold tables.');
    expect(chooseSystem).not.toContain('Never use pie charts.');

    const plain = new FakeModel([answer, { mappings: [] }]);
    await new PlannerService(rebindService as any, plain, loadCandidates).propose(
      'dashboard',
      'd1',
      {
        ask: 'copy this onto orders_gold',
      }
    );
    expect(plain.requests[0]?.system).not.toContain('authoring guidance');
  });

  it('reads addFilter, addVisual and addAction ops, with controls, placement, scope and actions', () => {
    const outline = [{ sheetId: 's1', name: 'Sheet', layout: 'grid' as const, elements: [] }];
    const blank = {
      elementId: '',
      col: -1,
      row: -1,
      colSpan: -1,
      rowSpan: -1,
      visualType: '',
      title: '',
      name: '',
      identifier: '',
      column: '',
    };
    const noFilter = {
      identifier: '',
      column: '',
      title: '',
      control: '',
      placement: '',
      appliesTo: [],
      values: [],
      hasRange: false,
      min: 0,
      max: 0,
      lastDays: 0,
    };
    const noAction = { kind: '', trigger: 'select', targets: [], fields: [], sheet: '' };
    const noVisual = {
      key: '',
      type: '',
      title: '',
      identifier: '',
      category: '',
      granularity: '',
      values: [],
      color: '',
      actions: [],
    };
    const ops = parseEditOps(
      {
        ops: [
          {
            ...blank,
            op: 'addFilter',
            sheetId: 's1',
            identifier: 'orders',
            column: 'region',
            filter: {
              ...noFilter,
              identifier: 'orders',
              column: 'region',
              control: 'singleSelect',
              placement: 'canvas',
              appliesTo: ['Detail'],
              values: ['West'],
            },
            visual: noVisual,
            action: noAction,
          },
          {
            ...blank,
            op: 'addFilter',
            sheetId: 's1',
            identifier: 'orders',
            filter: noFilter,
            visual: noVisual,
            action: noAction,
          },
          {
            ...blank,
            op: 'addVisual',
            sheetId: 's1',
            filter: noFilter,
            visual: {
              ...noVisual,
              key: 'detail',
              type: 'Table',
              title: 'Detail',
              identifier: 'orders',
              category: 'order_id',
              values: [{ column: 'revenue', aggregation: 'SUM' }],
            },
            action: noAction,
          },
          {
            ...blank,
            op: 'addAction',
            sheetId: 's1',
            elementId: 'v1',
            filter: noFilter,
            visual: noVisual,
            action: { ...noAction, kind: 'filter', targets: ['Detail'] },
          },
        ],
      },
      outline,
      new Set(['orders'])
    );
    expect(ops).toEqual([
      {
        op: 'addFilter',
        sheetId: 's1',
        identifier: 'orders',
        column: 'region',
        control: 'singleSelect',
        placement: 'canvas',
        appliesTo: ['Detail'],
        values: ['West'],
      },
      {
        op: 'addVisual',
        sheetId: 's1',
        visual: {
          key: 'detail',
          type: 'Table',
          title: 'Detail',
          identifier: 'orders',
          category: 'order_id',
          values: [{ column: 'revenue', aggregation: 'SUM' }],
        },
      },
      {
        op: 'addAction',
        sheetId: 's1',
        elementId: 'v1',
        action: { kind: 'filter', trigger: 'select', targets: ['Detail'] },
      },
    ]);
  });
});
