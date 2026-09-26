import { describe, expect, it } from 'vitest';

import type { DefinitionDataset, RepairPlan } from '@/shared/api/modules/authoring';

import {
  chosenFix,
  defaultChoices,
  describeFix,
  fixOptions,
  mergeRepairRebinds,
  repairRequests,
  repairSummary,
} from '../repair';

const RENAME = {
  op: 'rename',
  identifier: 'sales',
  columnName: 'revenue',
  to: 'net_revenue',
} as const;
const DROP = { op: 'dropColumn', identifier: 'sales', columnName: 'revenue' } as const;
const DROP_PROMO = { op: 'dropColumn', identifier: 'sales', columnName: 'promo_code' } as const;
const DECLARE = { op: 'declareParameter', name: 'region', type: 'STRING' } as const;
const DROP_PARAM = { op: 'dropParameter', name: 'region' } as const;

const PLAN: RepairPlan = {
  issues: [
    {
      id: 'column:sales:revenue',
      kind: 'column-missing',
      severity: 'error',
      message: 'revenue is gone',
      identifier: 'sales',
      columnName: 'revenue',
      fix: RENAME,
      alternatives: [DROP],
    },
    {
      id: 'column:sales:promo_code',
      kind: 'column-missing',
      severity: 'error',
      message: 'promo_code is gone',
      identifier: 'sales',
      columnName: 'promo_code',
      fix: DROP_PROMO,
      alternatives: [],
    },
    {
      id: 'parameter:region',
      kind: 'parameter-missing',
      severity: 'error',
      message: 'region undeclared',
      parameterName: 'region',
      fix: DECLARE,
      alternatives: [DROP_PARAM],
    },
    {
      id: 'dataset:targets',
      kind: 'dataset-missing',
      severity: 'error',
      message: 'targets cannot be read',
      identifier: 'targets',
      dataSetId: 'targets-2024',
      alternatives: [],
    },
    {
      id: 'quicksight:ACCESS_DENIED:4',
      kind: 'quicksight-error',
      severity: 'warning',
      message: 'theme unreadable',
      alternatives: [],
    },
  ],
  summary: { fixable: 3, needsChoice: 1, unfixable: 1 },
  proposed: { repairs: [DROP_PROMO, DECLARE], rebinds: [] },
};

const DATASETS: DefinitionDataset[] = [
  {
    identifier: 'sales',
    dataSetArn: 'arn:sales',
    dataSetId: 'sales-silver',
    columns: [],
    calculatedFields: [],
  },
  {
    identifier: 'targets',
    dataSetArn: 'arn:targets',
    dataSetId: 'targets-2024',
    columns: [],
    calculatedFields: [],
  },
];

describe('repair choices', () => {
  it('starts every issue on its proposed fix, or nothing', () => {
    const choices = defaultChoices(PLAN);
    expect(choices['column:sales:revenue']).toEqual(RENAME);
    expect(choices['dataset:targets']).toBeNull();
    expect(choices['quicksight:ACCESS_DENIED:4']).toBeNull();
  });

  it('an unset choice means the proposal; a set one wins, including leave', () => {
    const issue = PLAN.issues[0]!;
    expect(chosenFix(issue, {})).toEqual(RENAME);
    expect(chosenFix(issue, { [issue.id]: DROP })).toEqual(DROP);
    expect(chosenFix(issue, { [issue.id]: null })).toBeNull();
    expect(fixOptions(issue)).toEqual([RENAME, DROP]);
  });

  it('turns accepted fixes into repair ops and per-identifier renames', () => {
    expect(repairRequests(PLAN, {})).toEqual({
      repairs: [DROP_PROMO, DECLARE],
      columnMaps: { sales: { revenue: 'net_revenue' } },
    });
    expect(
      repairRequests(PLAN, { 'column:sales:revenue': DROP, 'parameter:region': null })
    ).toEqual({ repairs: [DROP, DROP_PROMO], columnMaps: {} });
  });

  it('folds renames into an existing rebind, or adds one to the current dataset', () => {
    const maps = { sales: { revenue: 'net_revenue' } };
    expect(mergeRepairRebinds([], DATASETS, maps)).toEqual([
      {
        identifier: 'sales',
        targetDataSetId: 'sales-silver',
        columnMap: { revenue: 'net_revenue' },
      },
    ]);
    expect(
      mergeRepairRebinds(
        [
          {
            identifier: 'sales',
            targetDataSetId: 'sales-gold',
            columnMap: { order_date: 'Order Date' },
          },
        ],
        DATASETS,
        maps
      )
    ).toEqual([
      {
        identifier: 'sales',
        targetDataSetId: 'sales-gold',
        columnMap: { revenue: 'net_revenue', order_date: 'Order Date' },
      },
    ]);
    // A person's own rename of the same column wins over the repair's.
    expect(
      mergeRepairRebinds(
        [{ identifier: 'sales', targetDataSetId: 'sales-gold', columnMap: { revenue: 'Revenue' } }],
        DATASETS,
        maps
      )[0]!.columnMap
    ).toEqual({ revenue: 'Revenue' });
  });

  it('summarises accepted, left and still-to-choose, and settles once a dataset is picked', () => {
    expect(repairSummary(PLAN, {}, {})).toEqual({ total: 5, accepted: 3, left: 1, needsChoice: 1 });
    expect(repairSummary(PLAN, {}, { targets: { id: 'x', name: 'x' } })).toEqual({
      total: 5,
      accepted: 4,
      left: 1,
      needsChoice: 0,
    });
    expect(repairSummary(PLAN, { 'parameter:region': null }, {}).accepted).toBe(2);
  });

  it('describes fixes in plain words', () => {
    expect(describeFix(RENAME)).toBe('Rename to net_revenue');
    expect(describeFix(DROP)).toBe('Remove every reference to it');
    expect(describeFix(DECLARE)).toBe('Declare it as STRING');
    expect(describeFix(null)).toBe('Leave as is');
  });
});
