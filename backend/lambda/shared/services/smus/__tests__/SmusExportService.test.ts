import { beforeEach, describe, expect, it, vi } from 'vitest';

import { roleArnFromCaller, SmusExportService } from '../SmusExportService';
import { SMUS_SNAPSHOT_KEY } from '../SmusSnapshot';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SESSION_ARN = 'arn:aws:sts::123456789012:assumed-role/Stack-LambdaExecutionRole7E2A/session';
const ROLE_ARN = 'arn:aws:iam::123456789012:role/Stack-LambdaExecutionRole7E2A';

const config = {
  enabled: true,
  domainId: 'dzd_1',
  region: 'us-east-1',
  portalUrl: 'https://smus.example',
  projectIds: [],
  databasePatterns: [],
};

const listing = (owningProjectId: string) => ({
  listingId: `l-${owningProjectId}`,
  assetId: `a-${owningProjectId}`,
  name: 'table',
  assetType: 'amazon.datazone.GlueTableAssetType',
  owningProjectId,
  glossaryTerms: [],
  forms: [],
});

describe('roleArnFromCaller', () => {
  it('turns an assumed-role session into the IAM role', () => {
    expect(roleArnFromCaller(SESSION_ARN)).toBe(ROLE_ARN);
  });

  it('leaves anything else alone', () => {
    expect(roleArnFromCaller('arn:aws:iam::1:user/me')).toBe('arn:aws:iam::1:user/me');
  });
});

describe('SmusExportService', () => {
  const adapter = {
    listAllListings: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    getIamRoleProfile: vi.fn(),
  };
  const sts = { getCallerIdentity: vi.fn() };
  const cache = { put: vi.fn() };
  const exporter = () =>
    new SmusExportService(cache as any, adapter as any, sts as any, config as any);

  beforeEach(() => {
    vi.clearAllMocks();
    sts.getCallerIdentity.mockResolvedValue({ arn: SESSION_ARN, account: '123456789012' });
    adapter.getProject.mockResolvedValue(null);
    cache.put.mockResolvedValue(undefined);
  });

  it('writes a snapshot that names the role and its missing profile when the role belongs to nothing', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockResolvedValue([]);
    adapter.getIamRoleProfile.mockResolvedValue(null);
    const progress = vi.fn().mockResolvedValue(undefined);

    const snapshot = await exporter().run('job-1', progress);

    expect(snapshot).toMatchObject({
      version: 1,
      domainId: 'dzd_1',
      region: 'us-east-1',
      jobId: 'job-1',
      projectFilter: [],
      projects: [],
      listings: [],
      diagnostics: {
        fromListProjects: 0,
        listings: 0,
        publishers: 0,
        callerArn: SESSION_ARN,
        roleArn: ROLE_ARN,
        profileStatus: 'not found',
      },
    });
    expect(snapshot.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(cache.put).toHaveBeenCalledWith(SMUS_SNAPSHOT_KEY, snapshot, { compact: true });
    expect(adapter.getIamRoleProfile).toHaveBeenCalledWith('dzd_1', ROLE_ARN);
    expect(progress.mock.calls.map((c) => c[0])).toEqual([
      'Sweeping the SMUS domain',
      'Swept the domain',
      'Wrote the snapshot: 0 projects, 0 listings',
    ]);
  });

  it('unions ListProjects with the publishers seen in the catalog, naming them through GetProject', async () => {
    adapter.listProjects.mockResolvedValue([{ id: 'p-member', name: 'member' }]);
    adapter.listAllListings.mockResolvedValue([listing('p-member'), listing('p-publisher')]);
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });
    adapter.getProject.mockResolvedValue({ id: 'p-publisher', name: 'publisher' });

    const snapshot = await exporter().run();

    expect(snapshot.projects.map((p) => p.id).sort()).toEqual(['p-member', 'p-publisher']);
    expect(snapshot.diagnostics).toMatchObject({
      fromListProjects: 1,
      listings: 2,
      publishers: 2,
      profileStatus: 'ACTIVATED',
    });
    expect(adapter.getProject).toHaveBeenCalledTimes(1);
  });

  it('records API failures and still writes what it got', async () => {
    adapter.listProjects.mockRejectedValue(new Error('AccessDenied'));
    adapter.listAllListings.mockResolvedValue([listing('p-publisher')]);
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });

    const snapshot = await exporter().run();

    expect(snapshot.diagnostics.listProjectsError).toContain('AccessDenied');
    expect(snapshot.listings).toHaveLength(1);
    expect(snapshot.projects.map((p) => p.id)).toEqual(['p-publisher']);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it('reports a hung call by name instead of hanging the job', async () => {
    vi.useFakeTimers();
    adapter.listProjects.mockReturnValue(new Promise(() => {}));
    adapter.listAllListings.mockResolvedValue([]);
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });

    const pending = exporter().run();
    await vi.advanceTimersByTimeAsync(120_001);
    const snapshot = await pending;
    vi.useRealTimers();

    expect(snapshot.diagnostics.listProjectsError).toBe(
      'TimeoutError: ListProjects timed out after 120000ms'
    );
  });

  it('limits listings to the selected projects, one filtered search each, and names them', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockImplementation(async (_d: string, projectId?: string) =>
      projectId ? [listing(projectId)] : [listing('p-a'), listing('p-b'), listing('p-other')]
    );
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });
    adapter.getProject.mockImplementation(async (_d: string, id: string) => ({
      id,
      name: `name-${id}`,
    }));

    const snapshot = await new SmusExportService(
      cache as any,
      adapter as any,
      sts as any,
      { ...config, projectIds: ['p-a', 'p-b'] } as any
    ).run();

    expect(adapter.listAllListings.mock.calls.map((c) => c[1])).toEqual(['p-a', 'p-b']);
    expect(snapshot.projectFilter).toEqual(['p-a', 'p-b']);
    expect(snapshot.listings.map((l) => l.owningProjectId)).toEqual(['p-a', 'p-b']);
    expect(snapshot.projects.map((p) => p.name).sort()).toEqual(['name-p-a', 'name-p-b']);
  });

  it('falls back to a domain sweep filtered locally when the owning-project filter is refused', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockImplementation(async (_d: string, projectId?: string) => {
      if (projectId) {
        throw Object.assign(new Error('Unsupported filter attribute'), {
          name: 'ValidationException',
        });
      }
      return [listing('p-a'), listing('p-other')];
    });
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });
    adapter.getProject.mockImplementation(async (_d: string, id: string) => ({ id, name: id }));

    const snapshot = await new SmusExportService(
      cache as any,
      adapter as any,
      sts as any,
      { ...config, projectIds: ['p-a'] } as any
    ).run();

    expect(snapshot.listings.map((l) => l.owningProjectId)).toEqual(['p-a']);
    expect(snapshot.diagnostics.listingsFallback).toContain('ValidationException');
    expect(snapshot.diagnostics.listingsError).toBeUndefined();
  });

  it('works without STS', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockResolvedValue([]);
    const snapshot = await new SmusExportService(
      cache as any,
      adapter as any,
      null,
      config as any
    ).run();
    expect(snapshot.diagnostics.callerArn).toBeUndefined();
  });
});
