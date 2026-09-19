import { describe, expect, it } from 'vitest';

import type { SheetOutline } from '@/shared/api/modules/authoring';

import { healthBadges, problemVisuals } from '../insights';
import {
  clampCol,
  clampColSpan,
  clampRowSpan,
  describeOp,
  findOutlineElement,
  groupChanges,
  isRetypable,
  opChangeKind,
} from '../ops';

const OUTLINE: SheetOutline[] = [
  {
    sheetId: 'sheet-overview',
    name: 'Overview',
    layout: 'grid',
    elements: [
      { elementId: 'bar-region', kind: 'visual', visualType: 'BarChart', title: 'Revenue by region' },
      { elementId: 'text-intro', kind: 'textBox' },
    ],
  },
];

describe('ops helpers', () => {
  it('only the server-supported visual types can be retyped', () => {
    expect(isRetypable('BarChart')).toBe(true);
    expect(isRetypable('PivotTable')).toBe(true);
    expect(isRetypable('KPI')).toBe(false);
    expect(isRetypable(undefined)).toBe(false);
  });

  it('keeps positions and spans on the 36-column grid', () => {
    expect(clampCol(-3)).toBe(0);
    expect(clampCol(40)).toBe(35);
    expect(clampColSpan(0)).toBe(1);
    expect(clampColSpan(50)).toBe(36);
    expect(clampColSpan(20, 30)).toBe(6);
    expect(clampRowSpan(0)).toBe(1);
  });

  it('finds elements in the outline', () => {
    expect(findOutlineElement(OUTLINE, 'sheet-overview', 'bar-region')?.element.title).toBe(
      'Revenue by region'
    );
    expect(findOutlineElement(OUTLINE, 'sheet-overview', 'nope')).toBeNull();
    expect(findOutlineElement(null, 'sheet-overview', 'bar-region')).toBeNull();
  });

  it('describes every op in words, naming the element when it can', () => {
    const s = 'sheet-overview';
    expect(describeOp({ op: 'move', sheetId: s, elementId: 'bar-region', col: 0, row: 6 }, OUTLINE)).toBe(
      'Move "Revenue by region" to column 0, row 6'
    );
    expect(describeOp({ op: 'resize', sheetId: s, elementId: 'text-intro', colSpan: 36, rowSpan: 2 }, OUTLINE)).toBe(
      'Resize text-intro to 36 × 2'
    );
    expect(describeOp({ op: 'retype', sheetId: s, elementId: 'bar-region', visualType: 'LineChart' }, OUTLINE)).toBe(
      'Change "Revenue by region" to a line chart'
    );
    expect(describeOp({ op: 'retitle', sheetId: s, elementId: 'bar-region', title: 'Sales', subtitle: '' }, OUTLINE)).toBe(
      'Retitle "Revenue by region": title "Sales", no subtitle'
    );
    expect(describeOp({ op: 'remove', sheetId: s, elementId: 'bar-region' })).toBe('Remove bar-region');
    expect(describeOp({ op: 'duplicate', sheetId: s, elementId: 'bar-region', title: 'Copy' }, OUTLINE)).toBe(
      'Duplicate "Revenue by region" as "Copy"'
    );
    expect(describeOp({ op: 'renameSheet', sheetId: s, name: 'Summary' }, OUTLINE)).toBe(
      'Rename sheet "Overview" to "Summary"'
    );
  });

  it('maps ops to change kinds and groups changes in a fixed order', () => {
    expect(opChangeKind({ op: 'move', sheetId: 's' })).toBe('layout');
    expect(opChangeKind({ op: 'renameSheet', sheetId: 's' })).toBe('sheet');
    expect(opChangeKind({ op: 'retitle', sheetId: 's' })).toBe('visual');

    const groups = groupChanges([
      { kind: 'visual', description: 'v' },
      { kind: 'rebind', description: 'r' },
      { kind: 'layout', description: 'l1' },
      { kind: 'layout', description: 'l2' },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Dataset', 'Layout', 'Visual']);
    expect(groups[1]?.items).toHaveLength(2);
  });
});

describe('insights', () => {
  const insights = {
    assetType: 'dashboard' as const,
    assetId: 'd',
    views: { total: 10, last30d: 2, uniqueViewers: 1 },
    health: {
      windowDays: 14,
      viewLoads: 100,
      visuals: [
        { sheetId: 's', visualId: 'slow', loadTimeP90Ms: 4800 },
        { sheetId: 's', visualId: 'broken', loadTimeP90Ms: 5000, errors: 3 },
        { sheetId: 's', visualId: 'fine', loadTimeP90Ms: 900, errors: 0 },
      ],
    },
  };

  it('badges every visual with a load time: timing when fine, slow or error otherwise', () => {
    const badges = healthBadges(insights);
    expect(badges.get('slow')).toEqual({
      kind: 'slow',
      value: '4.8s',
      label: 'p90 load time 4.8s over the last 14 days (over 3.0s)',
    });
    expect(badges.get('broken')).toEqual({
      kind: 'error',
      value: '5.0s',
      label: '3 load errors in the last 14 days, p90 load time 5.0s',
    });
    expect(badges.get('fine')).toEqual({
      kind: 'timing',
      value: '0.9s',
      label: 'p90 load time 0.9s over the last 14 days',
    });
    expect(problemVisuals(insights).map((v) => v.visualId)).toEqual(['slow', 'broken']);
    expect(healthBadges(null).size).toBe(0);
    expect(problemVisuals({ ...insights, health: undefined })).toEqual([]);
  });
});
