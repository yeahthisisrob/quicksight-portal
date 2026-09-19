import { beforeEach, describe, expect, it, vi } from 'vitest';

import { roleArnFromCaller, SmusService } from '../SmusService';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/settings/SettingsStore', () => ({
  settingsStore: { getString: () => '', getList: () => [], stored: () => ({}) },
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
});

describe('roleArnFromCaller', () => {
  it('turns an assumed-role session into the IAM role', () => {
    expect(roleArnFromCaller(SESSION_ARN)).toBe(ROLE_ARN);
  });

  it('leaves anything else alone', () => {
    expect(roleArnFromCaller('arn:aws:iam::1:user/me')).toBe('arn:aws:iam::1:user/me');
  });
});

describe('SmusService.projectDiscovery', () => {
  const adapter = {
    listAllListings: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    getIamRoleProfile: vi.fn(),
  };
  const sts = { getCallerIdentity: vi.fn() };
  const cache = { getAllDatasets: vi.fn(), getCacheEntries: vi.fn() };
  const service = () =>
    new SmusService(cache as any, adapter as any, config as any, null, sts as any);

  beforeEach(() => {
    vi.clearAllMocks();
    SmusService.invalidateLinkMap();
    sts.getCallerIdentity.mockResolvedValue({ arn: SESSION_ARN, account: '123456789012' });
    adapter.getProject.mockResolvedValue(null);
  });

  it('names the role and its profile when the role belongs to no project', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockResolvedValue([]);
    adapter.getIamRoleProfile.mockResolvedValue(null);

    const { projects, diagnostics } = await service().projectDiscovery();

    expect(projects).toEqual([]);
    expect(diagnostics).toMatchObject({
      fromListProjects: 0,
      listings: 0,
      publishers: 0,
      callerArn: SESSION_ARN,
      roleArn: ROLE_ARN,
      profileStatus: 'not found',
    });
    expect(adapter.getIamRoleProfile).toHaveBeenCalledWith('dzd_1', ROLE_ARN);
  });

  it('unions ListProjects with the publishers seen in the catalog', async () => {
    adapter.listProjects.mockResolvedValue([{ id: 'p-member', name: 'member' }]);
    adapter.listAllListings.mockResolvedValue([listing('p-member'), listing('p-publisher')]);
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });
    adapter.getProject.mockResolvedValue({ id: 'p-publisher', name: 'publisher' });

    const { projects, diagnostics } = await service().projectDiscovery();

    expect(projects.map((p) => p.id).sort()).toEqual(['p-member', 'p-publisher']);
    expect(diagnostics).toMatchObject({
      fromListProjects: 1,
      listings: 2,
      publishers: 2,
      profileStatus: 'ACTIVATED',
    });
  });

  it('reports API failures instead of throwing, and keeps what it got', async () => {
    adapter.listProjects.mockRejectedValue(new Error('AccessDenied'));
    adapter.listAllListings.mockResolvedValue([listing('p-publisher')]);
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });

    const { projects, diagnostics } = await service().projectDiscovery();

    expect(projects).toEqual([]);
    expect(diagnostics.listProjectsError).toContain('AccessDenied');
    expect(diagnostics.listings).toBe(1);
  });

  it('does not serve a stale empty list once the grant lands', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockResolvedValue([]);
    adapter.getIamRoleProfile.mockResolvedValue(null);
    await service().projectDiscovery();

    adapter.listProjects.mockResolvedValue([{ id: 'p-member', name: 'member' }]);
    adapter.getIamRoleProfile.mockResolvedValue({ id: 'u-1', status: 'ACTIVATED' });
    const { projects } = await service().projectDiscovery();

    expect(projects.map((p) => p.id)).toEqual(['p-member']);
  });

  it('works without an STS adapter', async () => {
    adapter.listProjects.mockResolvedValue([]);
    adapter.listAllListings.mockResolvedValue([]);
    const { diagnostics } = await new SmusService(
      cache as any,
      adapter as any,
      config as any
    ).projectDiscovery();
    expect(diagnostics.callerArn).toBeUndefined();
  });
});
