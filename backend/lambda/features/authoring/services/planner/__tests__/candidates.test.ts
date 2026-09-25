import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { rankCandidates } from '../PlannerService';

describe('planner candidates', () => {
  it('labels governed datasets with their listing and project, and puts them first', () => {
    const ranked = rankCandidates(
      [
        { id: 'a', name: 'Adhoc orders' },
        { id: 'g', name: 'Orders (gold)' },
      ],
      new Map([['g', { listing: 'orders_gold', project: 'sales_prod' }]])
    );
    expect(ranked).toEqual([
      {
        id: 'g',
        name: 'Orders (gold)',
        governed: { listing: 'orders_gold', project: 'sales_prod' },
      },
      { id: 'a', name: 'Adhoc orders' },
    ]);
  });
});
