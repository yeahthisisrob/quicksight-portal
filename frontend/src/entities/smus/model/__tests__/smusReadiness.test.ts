import { describe, expect, it } from 'vitest';

import { describeProjectDiagnostics, smusReadiness } from '../smusReadiness';

const project = { id: 'proj-1', name: 'published_prod' };
const diagnostics = {
  domainId: 'dzd_abc',
  region: 'us-east-1',
  fromListProjects: 0,
  listings: 0,
  publishers: 0,
};

describe('smusReadiness', () => {
  it('is not-configured when the domain is missing, whatever else is there', () => {
    expect(smusReadiness({ configured: false, projects: [project] })).toBe('not-configured');
  });

  it('is no-projects when the domain is set but nothing is reachable', () => {
    expect(smusReadiness({ configured: true, projects: [] })).toBe('no-projects');
  });

  it('is ready with one project', () => {
    expect(smusReadiness({ configured: true, projects: [project] })).toBe('ready');
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
