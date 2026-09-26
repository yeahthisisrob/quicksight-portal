import { describe, expect, it } from 'vitest';

import { collectDefinitionDatasets } from '../definitionColumns';
import { buildRepairPlan, quotedNames, type RepairTarget } from '../repairPlan';
import { sampleDefinition } from './fixtures';

const definition = sampleDefinition();
const datasets = collectDefinitionDatasets(definition);
const columnsOf = (identifier: string) =>
  datasets.find((d) => d.identifier === identifier)!.columns.map((c) => ({ name: c.name }));

const target = (id: string, name: string, columns: string[]): RepairTarget => ({
  dataSetId: id,
  name,
  columns: columns.map((c) => ({ name: c })),
});

describe('quotedNames', () => {
  it('pulls single-quoted names out of a QuickSight message', () => {
    expect(quotedNames("Column 'revenue' of dataset 'orders_gold' was not found")).toEqual([
      'revenue',
      'orders_gold',
    ]);
    expect(quotedNames('nothing quoted')).toEqual([]);
  });
});

describe('buildRepairPlan', () => {
  it('is empty when every column exists and every parameter is declared', () => {
    const plan = buildRepairPlan({
      definition: {
        ...definition,
        ParameterDeclarations: [
          ...definition.ParameterDeclarations,
          { IntegerParameterDeclaration: { Name: 'scale' } },
        ],
      },
      datasets,
      targets: new Map([
        [
          'orders',
          target(
            'ds-orders',
            'orders',
            columnsOf('orders').map((c) => c.name)
          ),
        ],
        [
          'regions',
          target(
            'ds-regions',
            'regions',
            columnsOf('regions').map((c) => c.name)
          ),
        ],
      ]),
    });
    expect(plan.issues).toEqual([]);
    expect(plan.summary).toEqual({ fixable: 0, needsChoice: 0, unfixable: 0 });
    expect(plan.proposed).toEqual({ repairs: [], rebinds: [] });
  });

  it('proposes a rename when one column clearly took the old name, and removal otherwise', () => {
    const ordersColumns = columnsOf('orders')
      .map((c) => c.name)
      .filter((n) => n !== 'revenue' && n !== 'status')
      .concat(['Revenue']);
    const plan = buildRepairPlan({
      definition,
      datasets,
      targets: new Map([
        ['orders', target('ds-orders', 'orders_gold', ordersColumns)],
        [
          'regions',
          target(
            'ds-regions',
            'regions',
            columnsOf('regions').map((c) => c.name)
          ),
        ],
      ]),
    });

    const revenue = plan.issues.find((i) => i.columnName === 'revenue')!;
    expect(revenue).toMatchObject({
      kind: 'column-missing',
      severity: 'error',
      identifier: 'orders',
      fix: { op: 'rename', identifier: 'orders', columnName: 'revenue', to: 'Revenue' },
    });
    expect(revenue.alternatives).toEqual([
      { op: 'dropColumn', identifier: 'orders', columnName: 'revenue' },
    ]);
    expect(revenue.message).toContain('visual');

    const status = plan.issues.find((i) => i.columnName === 'status')!;
    expect(status.fix).toEqual({ op: 'dropColumn', identifier: 'orders', columnName: 'status' });
    expect(status.alternatives).toEqual([]);

    // The fixture also references ${scale} without declaring it.
    expect(plan.proposed.repairs).toEqual([
      { op: 'dropColumn', identifier: 'orders', columnName: 'status' },
      { op: 'declareParameter', name: 'scale', type: 'STRING' },
    ]);
    expect(plan.proposed.rebinds).toEqual([
      { identifier: 'orders', targetDataSetId: 'ds-orders', columnMap: { revenue: 'Revenue' } },
    ]);
  });

  it('asks for a choice when a dataset cannot be read, and declares missing parameters', () => {
    const plan = buildRepairPlan({
      definition,
      datasets,
      targets: new Map([
        [
          'orders',
          target(
            'ds-orders',
            'orders',
            columnsOf('orders').map((c) => c.name)
          ),
        ],
        ['regions', null],
      ]),
    });
    const dataset = plan.issues.find((i) => i.kind === 'dataset-missing')!;
    expect(dataset).toMatchObject({ identifier: 'regions', severity: 'error' });
    expect(dataset.fix).toBeUndefined();

    const scale = plan.issues.find((i) => i.parameterName === 'scale')!;
    expect(scale.fix).toEqual({ op: 'declareParameter', name: 'scale', type: 'STRING' });
    expect(scale.alternatives).toEqual([{ op: 'dropParameter', name: 'scale' }]);

    expect(plan.summary).toEqual({ fixable: 1, needsChoice: 1, unfixable: 0 });
    expect(plan.proposed.repairs).toEqual([
      { op: 'declareParameter', name: 'scale', type: 'STRING' },
    ]);
  });

  it("attaches QuickSight's errors to the matching findings and lists the rest as-is", () => {
    const plan = buildRepairPlan({
      definition: {
        ...definition,
        ParameterDeclarations: [
          ...definition.ParameterDeclarations,
          { IntegerParameterDeclaration: { Name: 'scale' } },
        ],
      },
      datasets,
      targets: new Map([
        [
          'orders',
          target(
            'ds-orders',
            'orders',
            columnsOf('orders')
              .map((c) => c.name)
              .filter((n) => n !== 'revenue')
          ),
        ],
        [
          'regions',
          target(
            'ds-regions',
            'regions',
            columnsOf('regions').map((c) => c.name)
          ),
        ],
      ]),
      quickSightErrors: [
        {
          Type: 'COLUMN_NOT_FOUND',
          Message: "Column 'revenue' was not found",
          ViolatedEntities: [{ Path: 'sheets/s1/visuals/v1' }],
        },
        { Type: 'ACCESS_DENIED', Message: 'The theme cannot be read' },
      ],
    });

    const revenue = plan.issues.find((i) => i.columnName === 'revenue')!;
    expect(revenue.quickSight).toEqual({
      type: 'COLUMN_NOT_FOUND',
      message: "Column 'revenue' was not found",
      paths: ['sheets/s1/visuals/v1'],
    });
    const other = plan.issues.find((i) => i.kind === 'quicksight-error')!;
    expect(other).toMatchObject({ severity: 'warning', message: 'The theme cannot be read' });
    expect(other.fix).toBeUndefined();
    expect(plan.summary.unfixable).toBe(1);
  });
});
