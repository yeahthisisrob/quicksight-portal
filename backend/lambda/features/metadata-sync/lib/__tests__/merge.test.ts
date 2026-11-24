import { describe, expect, it } from 'vitest';

import { GLUE_SIDE, type Shown, smusSide, TABLE_KEY, type TableRecord } from '../../types';
import {
  applyWrites,
  baselineAfter,
  emptyRecord,
  GLUE_COMMENT_MAX,
  mergeTable,
  resolveConflict,
  shownAs,
} from '../merge';

const NOW = '2026-01-02T00:00:00.000Z';
const SMUS = smusSide('asset-1');
const fresh = () => emptyRecord('sales', 'orders', '2026-01-01T00:00:00.000Z');

/** A record that keeps `value` for one column and has synced it to both places. */
function synced(value: string, column = 'order_id'): TableRecord {
  return {
    ...fresh(),
    text: { [column]: { description: { value, from: 'glue', at: NOW } } },
    left: {
      [GLUE_SIDE]: { [column]: { description: value } },
      [SMUS]: { [column]: { description: value } },
    },
  };
}

const both = (glue: Shown, smus: Shown) => ({ [GLUE_SIDE]: glue, [SMUS]: smus });

describe('mergeTable', () => {
  it('adopts text found in one place and writes it to the other', () => {
    const out = mergeTable(
      fresh(),
      both({ order_id: { description: 'The order.' } }, { order_id: {} }),
      NOW
    );
    expect(out.adoptions).toEqual([
      { key: 'order_id', field: 'description', value: 'The order.', from: GLUE_SIDE },
    ]);
    expect(out.conflicts).toEqual([]);
    expect(out.writes[GLUE_SIDE]).toEqual([]);
    expect(out.writes[SMUS]).toEqual([
      { key: 'order_id', field: 'description', value: 'The order.' },
    ]);
    expect(out.record.text.order_id?.description).toMatchObject({
      value: 'The order.',
      from: 'glue',
    });
  });

  it('adopts once when both places already say the same', () => {
    const out = mergeTable(
      fresh(),
      both({ order_id: { description: 'Same.' } }, { order_id: { description: 'Same.' } }),
      NOW
    );
    expect(out.adoptions).toHaveLength(1);
    expect(out.conflicts).toEqual([]);
    expect(Object.values(out.writes).flat()).toEqual([]);
  });

  it('is a conflict, with nothing written, when two places disagree and nothing is kept', () => {
    const out = mergeTable(
      fresh(),
      both({ order_id: { description: 'One.' } }, { order_id: { description: 'Two.' } }),
      NOW
    );
    expect(out.adoptions).toEqual([]);
    expect(out.conflicts).toEqual([
      { key: 'order_id', field: 'description', sides: { [GLUE_SIDE]: 'One.', [SMUS]: 'Two.' } },
    ]);
    expect(Object.values(out.writes).flat()).toEqual([]);
    expect(out.record.text).toEqual({});
  });

  it('writes nothing when every place shows what is kept', () => {
    const out = mergeTable(
      synced('Kept.'),
      both({ order_id: { description: 'Kept.' } }, { order_id: { description: 'Kept.' } }),
      NOW
    );
    expect(out.adoptions).toEqual([]);
    expect(out.conflicts).toEqual([]);
    expect(Object.values(out.writes).flat()).toEqual([]);
  });

  it('adopts a hand edit and copies it over the other place', () => {
    const out = mergeTable(
      synced('Old.'),
      both({ order_id: { description: 'Old.' } }, { order_id: { description: 'New.' } }),
      NOW
    );
    expect(out.adoptions).toEqual([
      { key: 'order_id', field: 'description', value: 'New.', from: SMUS, replaced: 'Old.' },
    ]);
    expect(out.writes[GLUE_SIDE]).toEqual([
      { key: 'order_id', field: 'description', value: 'New.', was: 'Old.' },
    ]);
    expect(out.writes[SMUS]).toEqual([]);
    expect(out.record.history[0]).toMatchObject({ value: 'New.', replaced: 'Old.', from: 'smus' });
  });

  it('is a conflict when both places were edited differently since the last sync', () => {
    const out = mergeTable(
      synced('Old.'),
      both(
        { order_id: { description: 'Glue says.' } },
        { order_id: { description: 'SMUS says.' } }
      ),
      NOW
    );
    expect(out.conflicts).toEqual([
      {
        key: 'order_id',
        field: 'description',
        kept: 'Old.',
        sides: { [GLUE_SIDE]: 'Glue says.', [SMUS]: 'SMUS says.' },
      },
    ]);
    expect(Object.values(out.writes).flat()).toEqual([]);
    expect(out.record.text.order_id?.description?.value).toBe('Old.');
  });

  it('puts the text back on a table that was dropped and created again', () => {
    const out = mergeTable(
      synced('Kept.'),
      both({ order_id: {} }, { order_id: { description: 'Kept.' } }),
      NOW
    );
    expect(out.adoptions).toEqual([]);
    expect(out.conflicts).toEqual([]);
    expect(out.writes[GLUE_SIDE]).toEqual([
      { key: 'order_id', field: 'description', value: 'Kept.' },
    ]);
  });

  it('does not take other text in a place the sync never wrote as newer than what is kept', () => {
    const record = synced('Kept.');
    const other = smusSide('asset-2');
    const out = mergeTable(
      record,
      {
        [GLUE_SIDE]: { order_id: { description: 'Kept.' } },
        [other]: { order_id: { description: 'A second asset says.' } },
      },
      NOW
    );
    expect(out.adoptions).toEqual([]);
    expect(out.conflicts).toEqual([
      {
        key: 'order_id',
        field: 'description',
        kept: 'Kept.',
        sides: { [other]: 'A second asset says.' },
      },
    ]);
  });

  it('leaves alone a place that was not read', () => {
    const out = mergeTable(synced('Kept.'), { [SMUS]: { order_id: {} } }, NOW);
    expect(Object.keys(out.writes)).toEqual([SMUS]);
    expect(out.writes[SMUS]).toHaveLength(1);
  });

  it('cuts a long description to what a Glue comment holds and does not read the cut as an edit', () => {
    const long = 'x'.repeat(GLUE_COMMENT_MAX + 40);
    const first = mergeTable(
      fresh(),
      both({ order_id: {} }, { order_id: { description: long } }),
      NOW
    );
    const cutText = shownAs(GLUE_SIDE, 'order_id', 'description', long) as string;
    expect(cutText).toHaveLength(GLUE_COMMENT_MAX);
    expect(first.writes[GLUE_SIDE]).toEqual([
      { key: 'order_id', field: 'description', value: cutText },
    ]);

    const again = mergeTable(
      first.record,
      both({ order_id: { description: cutText } }, { order_id: { description: long } }),
      NOW
    );
    expect(again.adoptions).toEqual([]);
    expect(Object.values(again.writes).flat()).toEqual([]);
  });

  it('keeps a business name for SMUS alone: Glue has nowhere to put it', () => {
    const out = mergeTable(
      fresh(),
      both(
        { order_id: {}, [TABLE_KEY]: {} },
        { order_id: { businessName: 'Order number' }, [TABLE_KEY]: { businessName: 'Orders' } }
      ),
      NOW
    );
    expect(out.adoptions.map((a) => a.field)).toEqual(['businessName', 'businessName']);
    expect(out.writes[GLUE_SIDE]).toEqual([]);
  });
});

describe('baselineAfter', () => {
  it('records what the place shows, except a field in conflict, which keeps its old baseline', () => {
    const conflicts = [
      { key: 'a', field: 'description' as const, sides: { [GLUE_SIDE]: 'edited' } },
      { key: 'b', field: 'description' as const, sides: { [GLUE_SIDE]: 'new here' } },
    ];
    const next = baselineAfter(
      { a: { description: 'old' } },
      { a: { description: 'edited' }, b: { description: 'new here' }, c: { description: 'fine' } },
      conflicts,
      GLUE_SIDE
    );
    expect(next).toEqual({ a: { description: 'old' }, b: {}, c: { description: 'fine' } });
  });
});

describe('resolveConflict', () => {
  it('makes the pick the kept text, and the next pass copies it over both places', () => {
    const conflicted = mergeTable(
      synced('Old.'),
      both(
        { order_id: { description: 'Glue says.' } },
        { order_id: { description: 'SMUS says.' } }
      ),
      NOW
    );
    const conflict = conflicted.conflicts[0];
    if (!conflict) throw new Error('expected a conflict');
    const picked = resolveConflict(
      conflicted.record,
      { ...conflict, value: 'SMUS says.', by: 'someone' },
      NOW
    );
    expect(picked.history[0]).toMatchObject({ from: 'resolved', by: 'someone', replaced: 'Old.' });

    const next = mergeTable(
      picked,
      both(
        { order_id: { description: 'Glue says.' } },
        { order_id: { description: 'SMUS says.' } }
      ),
      NOW
    );
    expect(next.conflicts).toEqual([]);
    expect(next.adoptions).toEqual([]);
    expect(next.writes[GLUE_SIDE]).toEqual([
      { key: 'order_id', field: 'description', value: 'SMUS says.', was: 'Glue says.' },
    ]);
    expect(next.writes[SMUS]).toEqual([]);
  });
});

describe('applyWrites', () => {
  it('shows the written fields and keeps the rest', () => {
    expect(
      applyWrites({ a: { description: 'x', businessName: 'A' } }, [
        { key: 'a', field: 'description', value: 'y' },
        { key: 'b', field: 'description', value: 'z' },
      ])
    ).toEqual({ a: { description: 'y', businessName: 'A' }, b: { description: 'z' } });
  });
});
