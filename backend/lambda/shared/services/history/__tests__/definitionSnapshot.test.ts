import { describe, expect, it } from 'vitest';

import { definitionHash, snapshotOf, stable } from '../definitionSnapshot';

const exploration = (over: Record<string, unknown> = {}) => ({
  apiResponses: {
    list: {
      timestamp: '2026-10-01T00:00:00.000Z',
      data: { Name: 'Sales', Version: { VersionNumber: 3 } },
    },
    definition: {
      timestamp: '2026-10-01T00:00:00.000Z',
      data: {
        Name: 'Sales',
        Definition: { Sheets: [{ SheetId: 's1', Name: 'Overview', Visuals: [] }] },
        ResourceStatus: 'CREATION_SUCCESSFUL',
        Errors: [],
        ...over,
      },
    },
  },
});

describe('definition snapshots', () => {
  it('hashes the same when only volatile fields differ', () => {
    const a = snapshotOf('dashboard', exploration({ ResourceStatus: 'UPDATE_IN_PROGRESS' }));
    const b = snapshotOf('dashboard', exploration({ Errors: [{ Type: 'x' }] }));
    expect(a?.hash).toBe(b?.hash);
    expect(a?.definition).not.toHaveProperty('ResourceStatus');
    expect(a?.name).toBe('Sales');
    expect(a?.quickSightVersion).toBe(3);
  });

  it('hashes differently when the definition changes', () => {
    const a = snapshotOf('dashboard', exploration());
    const b = snapshotOf(
      'dashboard',
      exploration({ Definition: { Sheets: [{ SheetId: 's1', Name: 'Renamed', Visuals: [] }] } })
    );
    expect(a?.hash).not.toBe(b?.hash);
  });

  it('reads a dataset from its describe response, without its timestamps and SPICE size', () => {
    const snapshot = snapshotOf('dataset', {
      apiResponses: {
        list: { timestamp: 't', data: { Name: 'Orders' } },
        describe: {
          timestamp: 't',
          data: {
            Name: 'Orders',
            ImportMode: 'SPICE',
            LastUpdatedTime: '2026-10-01T00:00:00.000Z',
            ConsumedSpiceCapacityInBytes: 12345,
            PhysicalTableMap: { t: { RelationalTable: { Schema: 'gold', Name: 'orders' } } },
          },
        },
      },
    });
    expect(snapshot?.definition).toEqual({
      ImportMode: 'SPICE',
      Name: 'Orders',
      PhysicalTableMap: { t: { RelationalTable: { Name: 'orders', Schema: 'gold' } } },
    });
  });

  it('has nothing to keep when the document carries no definition', () => {
    expect(
      snapshotOf('analysis', { apiResponses: { list: { timestamp: 't', data: {} } } })
    ).toBeNull();
    expect(
      snapshotOf('dataset', { apiResponses: { describe: { timestamp: 't', data: null } } })
    ).toBeNull();
  });

  it('orders keys so equal content hashes equal', () => {
    expect(definitionHash({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(
      definitionHash({ a: [{ c: 2, d: 1 }], b: 1 })
    );
    expect(stable({ b: 1, a: 2 })).toEqual({ a: 2, b: 1 });
  });
});
