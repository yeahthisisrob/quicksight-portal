import { describe, expect, it } from 'vitest';

import type { SettingsSnapshot } from '@/shared/api/modules/settings';

import { describeProjectDiagnostics, selectedProjectIds, smusReadiness } from '../smusReadiness';

function snapshot(
  domainId: string | undefined,
  projectIds: string[] | undefined
): SettingsSnapshot {
  const base = { label: '', description: '', source: 'stored' as const, sensitive: false };
  return {
    groups: [
      {
        id: 'smus',
        title: 'SMUS',
        description: '',
        settings: [
          { ...base, key: 'smus.domainId', type: 'string', value: domainId },
          { ...base, key: 'smus.projectIds', type: 'multiselect', value: projectIds },
        ],
      },
    ],
  } as SettingsSnapshot;
}

const diagnostics = {
  domainId: 'dzd_abc',
  region: 'us-east-1',
  fromListProjects: 0,
  listings: 0,
  publishers: 0,
};

describe('smusReadiness', () => {
  it('is not-configured without a domain, whatever projects say', () => {
    expect(smusReadiness(snapshot(undefined, ['p1']))).toBe('not-configured');
    expect(smusReadiness(snapshot('  ', ['p1']))).toBe('not-configured');
  });

  it('is no-projects when a domain is set but nothing is selected', () => {
    expect(smusReadiness(snapshot('dzd_1', []))).toBe('no-projects');
    expect(smusReadiness(snapshot('dzd_1', undefined))).toBe('no-projects');
  });

  it('is ready with one selected project', () => {
    expect(smusReadiness(snapshot('dzd_1', ['p1']))).toBe('ready');
  });

  it('reads the selected ids and ignores a malformed value', () => {
    expect(selectedProjectIds(snapshot('dzd_1', ['p1', 'p2']))).toEqual(['p1', 'p2']);
    expect(selectedProjectIds({ groups: [] })).toEqual([]);
  });
});

describe('describeProjectDiagnostics', () => {
  it('says nothing without diagnostics', () => {
    expect(describeProjectDiagnostics(undefined)).toBeUndefined();
  });

  it('points at the grant recipe when ListProjects returned nothing and did not fail', () => {
    const text = describeProjectDiagnostics(diagnostics) ?? '';
    expect(text).toContain('dzd_abc (us-east-1)');
    expect(text).toContain('just smus-grant');
    expect(text).toContain('No published listings');
  });

  it('names the role and says the profile is missing', () => {
    const text =
      describeProjectDiagnostics({
        ...diagnostics,
        callerArn: 'arn:aws:sts::1:assumed-role/Stack-LambdaExecutionRole/s',
        roleArn: 'arn:aws:iam::1:role/Stack-LambdaExecutionRole',
        profileStatus: 'not found',
      }) ?? '';
    expect(text).toContain('Calling DataZone as arn:aws:iam::1:role/Stack-LambdaExecutionRole');
    expect(text).toContain('no user profile in the domain');
  });

  it('says the role is known but a member of nothing when the profile exists', () => {
    const text =
      describeProjectDiagnostics({
        ...diagnostics,
        roleArn: 'arn:aws:iam::1:role/Stack-LambdaExecutionRole',
        profileStatus: 'ACTIVATED',
      }) ?? '';
    expect(text).toContain('(domain profile: ACTIVATED)');
    expect(text).toContain('member of no project');
    expect(text).not.toContain('no user profile');
  });

  it('says when no listing published a column list, and what they did publish', () => {
    const text =
      describeProjectDiagnostics({
        ...diagnostics,
        listings: 12,
        listingsWithColumns: 0,
        formNames: ['GlueTableForm', 'OwnershipForm'],
      }) ?? '';
    expect(text).toContain('No listing published a column list');
    expect(text).toContain('GlueTableForm, OwnershipForm');
  });

  it('counts the listings that did publish one', () => {
    const text =
      describeProjectDiagnostics({ ...diagnostics, listings: 12, listingsWithColumns: 9 }) ?? '';
    expect(text).toContain('9 of 12 listings published a column list');
    expect(text).not.toContain('No listing published');
  });

  it('says when the per-project filter was refused and the domain swept instead', () => {
    const text =
      describeProjectDiagnostics({ ...diagnostics, listingsFallback: 'ValidationException' }) ?? '';
    expect(text).toContain('Per-project listing filter refused (ValidationException)');
  });

  it('reports the API errors instead of guessing', () => {
    const text =
      describeProjectDiagnostics({
        ...diagnostics,
        listProjectsError: 'AccessDenied',
        listingsError: 'Throttled',
      }) ?? '';
    expect(text).toContain('ListProjects failed: AccessDenied');
    expect(text).toContain('SearchListings failed: Throttled');
    expect(text).not.toContain('just smus-grant');
    expect(text).not.toContain('No published listings');
  });
});
