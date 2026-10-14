import { describe, expect, it } from 'vitest';

import { isQuickSightColumnType, toQuickSightColumnType } from '../columnTypes';

describe('columnTypes', () => {
  it('maps source types to QuickSight input types', () => {
    expect(
      [
        'bigint',
        'int',
        'double',
        'decimal(10,2)',
        'boolean',
        'timestamp',
        'date',
        'varchar(20)',
        'array<string>',
        'json',
      ].map(toQuickSightColumnType)
    ).toEqual([
      'INTEGER',
      'INTEGER',
      'DECIMAL',
      'DECIMAL',
      'BOOLEAN',
      'DATETIME',
      'DATETIME',
      'STRING',
      'STRING',
      'STRING',
    ]);
  });

  it('knows the vocabulary a caller may declare', () => {
    expect(isQuickSightColumnType('DECIMAL')).toBe(true);
    expect(isQuickSightColumnType('decimal')).toBe(false);
    expect(isQuickSightColumnType(undefined)).toBe(false);
  });
});
