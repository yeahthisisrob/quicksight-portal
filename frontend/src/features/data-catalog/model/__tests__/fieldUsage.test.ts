import { describe, expect, it } from 'vitest';

import type { FieldUsedIn, FieldVisualUsage } from '@/shared/api/modules/data-catalog';

import { filterUsage, summarizeUsage, usageRows } from '../fieldUsage';

const OVERVIEW: FieldUsedIn = {
  assetType: 'dashboard',
  assetId: 'd-1',
  assetName: 'Sales overview',
};
const EXPLORE: FieldUsedIn = { assetType: 'analysis', assetId: 'a-1', assetName: 'Explorations' };
const QUIET: FieldUsedIn = { assetType: 'dashboard', assetId: 'd-2', assetName: 'Board pack' };

const VISUALS: FieldVisualUsage[] = [
  { ...OVERVIEW, sheetName: 'Overview', visualId: 'v2', visualName: 'Monthly trend' },
  { ...OVERVIEW, sheetName: 'Overview', visualId: 'v1', visualName: 'Margin KPI' },
  { ...EXPLORE, visualId: 'v3', visualName: 'Scratch table' },
];

describe('usageRows', () => {
  it('gives one row per visual, and one per asset that names no visual', () => {
    const rows = usageRows([OVERVIEW, EXPLORE, QUIET], VISUALS);

    expect(rows.map((r) => `${r.assetName}/${r.visualName || '-'}`)).toEqual([
      'Board pack/-',
      'Explorations/Scratch table',
      'Sales overview/Margin KPI',
      'Sales overview/Monthly trend',
    ]);
    expect(rows.find((r) => r.assetId === 'd-2')?.inVisual).toBe(false);
    expect(rows.every((r) => r.id)).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('does not repeat an asset that already has visuals', () => {
    const rows = usageRows([OVERVIEW], VISUALS.slice(0, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.inVisual).toBe(true);
  });
});

describe('summarizeUsage', () => {
  it('counts assets once and visuals every time', () => {
    expect(summarizeUsage(usageRows([OVERVIEW, EXPLORE, QUIET], VISUALS))).toEqual({
      dashboards: 2,
      analyses: 1,
      visuals: 3,
      withoutVisual: 1,
    });
  });
});

describe('filterUsage', () => {
  it('matches the asset, the sheet and the visual, and ignores blank search', () => {
    const rows = usageRows([OVERVIEW, EXPLORE, QUIET], VISUALS);
    expect(filterUsage(rows, 'trend').map((r) => r.visualName)).toEqual(['Monthly trend']);
    expect(filterUsage(rows, 'overview')).toHaveLength(2);
    expect(filterUsage(rows, '  ')).toHaveLength(rows.length);
  });
});
