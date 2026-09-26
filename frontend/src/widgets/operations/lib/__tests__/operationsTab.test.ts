import { describe, expect, it } from 'vitest';

import {
  isOperationsTab,
  LEGACY_OPERATIONS_ROUTES,
  operationsTabSearch,
  parseOperationsTab,
} from '../operationsTab';

describe('operations tab URL sync', () => {
  it('reads a known tab from the query parameter', () => {
    expect(parseOperationsTab('archived')).toBe('archived');
    expect(parseOperationsTab('smus')).toBe('smus');
    expect(parseOperationsTab('jobs')).toBe('jobs');
  });

  it('falls back to export for anything unknown or missing', () => {
    expect(parseOperationsTab(null)).toBe('export');
    expect(parseOperationsTab(undefined)).toBe('export');
    expect(parseOperationsTab('nope')).toBe('export');
    expect(parseOperationsTab('')).toBe('export');
    // Scripts moved to the Author Studio.
    expect(parseOperationsTab('scripts')).toBe('export');
  });

  it('leaves the default tab out of the URL', () => {
    expect(operationsTabSearch('export')).toBe('');
    expect(operationsTabSearch('archived')).toBe('?tab=archived');
  });

  it('round-trips every tab', () => {
    for (const tab of ['export', 'jobs', 'smus', 'archived'] as const) {
      const search = new URLSearchParams(operationsTabSearch(tab));
      expect(parseOperationsTab(search.get('tab'))).toBe(tab);
    }
  });

  it('maps every legacy route to a real tab', () => {
    for (const tab of Object.values(LEGACY_OPERATIONS_ROUTES)) {
      expect(isOperationsTab(tab)).toBe(true);
    }
  });
});
