import { describe, expect, it } from 'vitest';

import { requestErrors } from '../contract';

describe('requestErrors against the served contract', () => {
  const create = {
    assetType: 'analysis',
    name: 'Orders',
    datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
  };

  it('passes a body that fits its operation, extra fields and all', () => {
    expect(
      requestErrors('POST', '/api/authoring/new', {
        ...create,
        filters: [{ identifier: 'orders', column: 'region', control: 'dropdown' }],
        somethingNew: true,
      })
    ).toEqual([]);
  });

  it('names what does not fit: a missing field, a wrong type, a value outside its enum', () => {
    expect(requestErrors('POST', '/api/authoring/new', { assetType: 'analysis' })).toEqual([
      'name: required',
      'datasets: required',
    ]);
    expect(
      requestErrors('POST', '/api/authoring/new', {
        ...create,
        filters: [{ identifier: 'orders', column: 'region', control: 'checkbox' }],
      })
    ).toEqual([
      'filters[0].control: must be one of dropdown, singleSelect, list, dateRange, relativeDate, slider',
    ]);
    expect(
      requestErrors('POST', '/api/authoring/analysis/a1/rebind', {
        mode: 'update',
        rebinds: [],
        ops: [{ op: 'addAction', sheetId: 's1', action: { kind: 'drill' } }],
      })
    ).toEqual(['ops[0].action.kind: must be one of filter, navigate']);
  });

  it('leaves a path that is not an operation to the router', () => {
    expect(requestErrors('POST', '/api/nowhere', { anything: 1 })).toEqual([]);
  });
});
