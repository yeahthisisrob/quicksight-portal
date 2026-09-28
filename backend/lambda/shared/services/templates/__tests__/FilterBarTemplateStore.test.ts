import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  FilterBarTemplateStore,
  filtersFromTemplate,
  validateFilterBarInput,
} from '../FilterBarTemplateStore';

describe('filter bar templates', () => {
  it('validates a bar: named, 1-12 distinct columns, widths 1-6 (2 by default)', () => {
    expect(
      validateFilterBarInput({
        name: ' Standard ',
        isDefault: true,
        controls: [
          { column: 'order_date' },
          { column: 'Region', span: 3, title: 'Region', values: ['West', ''] },
        ],
      })
    ).toEqual({
      name: 'Standard',
      isDefault: true,
      controls: [
        { column: 'order_date', span: 2 },
        { column: 'Region', span: 3, title: 'Region', values: ['West'] },
      ],
    });
    expect(() => validateFilterBarInput({ name: 'x', controls: [] })).toThrow('1 to 12');
    expect(() =>
      validateFilterBarInput({ name: 'x', controls: [{ column: 'a' }, { column: 'A' }] })
    ).toThrow('already in the bar');
    expect(() =>
      validateFilterBarInput({ name: 'x', controls: [{ column: 'a', span: 9 }] })
    ).toThrow('span');
  });

  it('places each control on the first dataset that has its column, and names the rest', () => {
    const { filters, skipped } = filtersFromTemplate(
      {
        name: 'Standard',
        controls: [
          { column: 'region', span: 3 },
          { column: 'segment', span: 2 },
        ],
      },
      [
        { identifier: 'orders', columns: [{ name: 'order_id' }] },
        { identifier: 'regions', columns: [{ name: 'Region' }] },
      ]
    );
    expect(filters).toEqual([{ identifier: 'regions', column: 'region', span: 3 }]);
    expect(skipped).toEqual(['segment']);
  });

  describe('the store', () => {
    let table: PortalTestTable;
    beforeAll(async () => {
      table = await startPortalTestTable();
    });
    afterAll(async () => {
      await table.stop();
    });
    const store = new FilterBarTemplateStore();

    it('keeps one default, and lists it first', async () => {
      const a = await store.create(
        { name: 'A', isDefault: true, controls: [{ column: 'x', span: 2 }] },
        'me'
      );
      const b = await store.create(
        { name: 'B', isDefault: true, controls: [{ column: 'y', span: 2 }] },
        'me'
      );
      const listed = await store.list();
      expect(listed.map((t) => [t.name, t.isDefault])).toEqual([
        ['B', true],
        ['A', false],
      ]);
      expect((await store.getDefault())?.id).toBe(b.id);
      expect(listed[1]!.id).toBe(a.id);
      expect(listed[1]!.controls).toEqual([{ column: 'x', span: 2 }]);
    });
  });
});
