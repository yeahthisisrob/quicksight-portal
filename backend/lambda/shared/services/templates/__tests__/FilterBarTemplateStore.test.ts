import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    const items: any[] = [];
    const dynamo = {
      queryPartition: vi.fn(async () => items.map((i) => ({ ...i }))),
      getItem: vi.fn(async (_t: string, key: any) => items.find((i) => i.sk === key.sk) ?? null),
      putItem: vi.fn(async (_t: string, item: any) => {
        const at = items.findIndex((i) => i.sk === item.sk);
        if (at >= 0) items[at] = item;
        else items.push(item);
      }),
      deleteItem: vi.fn(),
    };
    const store = new FilterBarTemplateStore(dynamo as any, 'jobs');

    beforeEach(() => {
      items.length = 0;
    });

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
      expect(listed[0]).not.toHaveProperty('pk');
    });
  });
});
