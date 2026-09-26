import { describe, expect, it } from 'vitest';

import { carryForward, isMissingObject } from '../exportRecord';

const at = (t: string, data: unknown) => ({ timestamp: t, data });

describe('carryForward', () => {
  it('keeps what a run did not fetch, and takes what it did', () => {
    const previous = {
      apiResponses: {
        list: at('old', { Name: 'Old name' }),
        describe: at('old', { Name: 'Old name' }),
        definition: at('old', { Sheets: [1] }),
        permissions: at('old', [{ Principal: 'arn:user/rob' }]),
        tags: at('old', [{ key: 'team', value: 'sales' }]),
      },
    } as any;
    const next = {
      apiResponses: {
        list: at('new', { Name: 'New name' }),
        permissions: at('new', [{ Principal: 'arn:user/ann' }]),
      },
    } as any;

    const merged = carryForward(next, previous).apiResponses as any;
    expect(merged.list.data.Name).toBe('New name');
    expect(merged.permissions.data[0].Principal).toBe('arn:user/ann');
    expect(merged.definition.data.Sheets).toEqual([1]);
    expect(merged.tags.data[0].key).toBe('team');
    expect(merged.describe.timestamp).toBe('old');
  });

  it('keeps an empty result this run fetched: no tags is an answer', () => {
    const previous = { apiResponses: { tags: at('old', [{ key: 'team', value: 'x' }]) } } as any;
    const next = { apiResponses: { list: at('new', {}), tags: at('new', []) } } as any;
    expect((carryForward(next, previous).apiResponses as any).tags.data).toEqual([]);
  });

  it('is the next record as-is without a previous one', () => {
    const next = { apiResponses: { list: at('new', {}) } } as any;
    expect(carryForward(next, null)).toBe(next);
  });
});

describe('isMissingObject', () => {
  it('tells a missing object from a failed read', () => {
    expect(isMissingObject(Object.assign(new Error('x'), { name: 'NoSuchKey' }))).toBe(true);
    expect(isMissingObject(new Error('The specified key does not exist.'))).toBe(true);
    expect(isMissingObject(Object.assign(new Error('slow down'), { name: 'SlowDown' }))).toBe(
      false
    );
    expect(isMissingObject(new Error('Object body is empty for x'))).toBe(false);
  });
});
