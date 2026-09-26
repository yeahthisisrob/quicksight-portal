import { describe, expect, it } from 'vitest';

import { listOptions, readJobsFilters, writeJobsFilters } from '../jobsFilters';

describe('jobs filters', () => {
  it('reads the filters, ignoring what it does not know', () => {
    expect(
      readJobsFilters(
        new URLSearchParams('tab=jobs&type=smus-export&status=failed&since=24h&job=j-1')
      )
    ).toEqual({ type: 'smus-export', status: 'failed', since: '24h', job: 'j-1' });
    expect(readJobsFilters(new URLSearchParams('type=nope&status=nope&since=forever'))).toEqual({
      since: '7d',
    });
  });

  it('writes a patch, leaving other params and the default window out', () => {
    const next = writeJobsFilters(new URLSearchParams('tab=jobs&type=export'), {
      type: undefined,
      status: 'failed',
      since: '7d',
    });
    expect(next.toString()).toBe('tab=jobs&status=failed');
  });

  it('asks the list endpoint for the window as a start date', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    expect(listOptions({ since: '24h', type: 'export' }, now)).toEqual({
      limit: 500,
      type: 'export',
      afterDate: '2026-09-25T12:00:00.000Z',
    });
    expect(listOptions({ since: 'all', status: 'failed' }, now)).toEqual({
      limit: 500,
      status: 'failed',
    });
  });
});
