import { describe, expect, it } from 'vitest';

import {
  ALL_SUMMARIES,
  CUSTOMER_SUMMARY,
  PROJECTS,
  SALES_SUMMARY,
  TARGETS_SUMMARY,
} from '../../ui/__stories__/fixtures';
import {
  ALL_PROJECTS,
  countCatalog,
  filterAssets,
  OUTSIDE_SMUS,
  pickProject,
  readCatalogState,
  scopeFor,
  termsOf,
  writeCatalogState,
} from '../catalogState';

describe('URL state', () => {
  it('reads the four keys and ignores blanks', () => {
    const params = new URLSearchParams('project=p1&asset=%20&term=Revenue&q=sales');
    expect(readCatalogState(params)).toEqual({ project: 'p1', term: 'Revenue', q: 'sales' });
  });

  it('writes a patch without touching other keys and removes empties', () => {
    const params = new URLSearchParams('project=p1&asset=a1&tab=x');
    const next = writeCatalogState(params, { asset: undefined, term: 'PII', q: '' });
    expect(next.toString()).toBe('project=p1&tab=x&term=PII');
  });
});

describe('scopeFor', () => {
  it('turns the picker value into a scope and a project', () => {
    expect(scopeFor(undefined)).toEqual({ scope: 'smus' });
    expect(scopeFor(ALL_PROJECTS)).toEqual({ scope: 'smus' });
    expect(scopeFor('proj-analytics-dev')).toEqual({
      scope: 'smus',
      projectId: 'proj-analytics-dev',
    });
    // The datasets no listing claimed are a scope of their own, not a project.
    expect(scopeFor(OUTSIDE_SMUS)).toEqual({ scope: 'outside' });
  });
});

describe('pickProject', () => {
  it('spans every project when the tab allows it, which is no filter at all', () => {
    // The field-first tabs are QuickSight's own data, so they default to all.
    expect(pickProject(PROJECTS, undefined, true)).toBeUndefined();
    expect(pickProject(PROJECTS, ALL_PROJECTS, true)).toBeUndefined();
    expect(pickProject(PROJECTS, 'proj-analytics-dev', true)?.id).toBe('proj-analytics-dev');
    // A project that is no longer selected in Settings falls back to all, not
    // to some other project's data.
    expect(pickProject(PROJECTS, 'gone', true)).toBeUndefined();
  });

  it('prefers the requested project and falls back to the first', () => {
    expect(pickProject(PROJECTS, 'proj-analytics-dev')?.id).toBe('proj-analytics-dev');
    expect(pickProject(PROJECTS, 'nope')?.id).toBe('proj-analytics-prod');
    expect(pickProject(PROJECTS)?.id).toBe('proj-analytics-prod');
    expect(pickProject([], 'x')).toBeUndefined();
  });
});

describe('filterAssets', () => {
  it('filters by glossary term', () => {
    expect(filterAssets(ALL_SUMMARIES, { term: 'PII' })).toEqual([CUSTOMER_SUMMARY]);
    expect(filterAssets(ALL_SUMMARIES, { term: 'Revenue' }).map((a) => a.listingId)).toEqual([
      SALES_SUMMARY.listingId,
      TARGETS_SUMMARY.listingId,
    ]);
  });

  it('narrows to assets whose datasets carry the chosen tags, and null means no filter', () => {
    const tagged = new Set(['ds-targets']);
    expect(filterAssets(ALL_SUMMARIES, { taggedDatasetIds: tagged })).toEqual([TARGETS_SUMMARY]);
    expect(filterAssets(ALL_SUMMARIES, { taggedDatasetIds: null })).toHaveLength(4);
    expect(filterAssets(ALL_SUMMARIES, { taggedDatasetIds: new Set() })).toHaveLength(0);
  });
});

describe('counts and terms', () => {
  it('counts assets with and without datasets, calculated fields and distinct terms', () => {
    expect(countCatalog(ALL_SUMMARIES)).toEqual({
      assets: 4,
      withDataset: 2,
      withoutDataset: 2,
      calculatedFields: 4,
      terms: 3,
    });
    expect(countCatalog([])).toEqual({
      assets: 0,
      withDataset: 0,
      withoutDataset: 0,
      calculatedFields: 0,
      terms: 0,
    });
  });

  it('lists terms most common first, keeping the description', () => {
    const terms = termsOf(ALL_SUMMARIES);
    expect(terms.map((t) => `${t.name}:${t.count}`)).toEqual(['Customer:2', 'Revenue:2', 'PII:1']);
    expect(terms[2]?.shortDescription).toContain('personal data');
  });
});
