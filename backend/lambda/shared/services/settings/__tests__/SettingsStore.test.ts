import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsStore } from '../SettingsStore';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const dynamo = { getItem: vi.fn(), putItem: vi.fn() };

describe('SettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamo.getItem.mockResolvedValue({
      pk: 'SETTINGS',
      sk: 'portal',
      values: { 'smus.domainId': 'dzd_stored', 'smus.projectIds': ['p1'] },
      updatedAt: '2026-09-18T00:00:00Z',
      updatedBy: 'rob',
    });
  });

  const store = (env: NodeJS.ProcessEnv = {}) =>
    new SettingsStore(dynamo as any, 'settings-table', env);

  it('reads the one settings item and resolves stored over env', async () => {
    const s = store({ SMUS_DOMAIN_ID: 'dzd_env', SMUS_DOMAIN_REGION: 'eu-west-1' });
    await s.load();
    expect(dynamo.getItem).toHaveBeenCalledWith('settings-table', { pk: 'SETTINGS', sk: 'portal' });
    expect(s.getString('smus.domainId')).toBe('dzd_stored');
    expect(s.getString('smus.region')).toBe('eu-west-1');
    expect(s.getList('smus.projectIds')).toEqual(['p1']);
    expect(s.snapshot().updatedBy).toBe('rob');
  });

  it('caches within the TTL and refreshes when forced', async () => {
    const s = store();
    await s.load();
    await s.load();
    expect(dynamo.getItem).toHaveBeenCalledTimes(1);
    await s.load(true);
    expect(dynamo.getItem).toHaveBeenCalledTimes(2);
  });

  it('keeps running from the environment when the table cannot be read', async () => {
    dynamo.getItem.mockRejectedValue(new Error('no table'));
    const s = store({ SMUS_DOMAIN_ID: 'dzd_env' });
    await expect(s.load()).resolves.toBeUndefined();
    expect(s.getString('smus.domainId')).toBe('dzd_env');
    expect(s.snapshot().groups[0]?.settings[0]?.source).toBe('env');
  });

  it('merges an update, clears nulls and empties, and stamps who saved', async () => {
    const s = store();
    await s.load();
    const snapshot = await s.save(
      { 'smus.projectIds': null, 'planner.modelId': 'grok-4', 'smus.portalUrl': '' },
      'rob@example.com'
    );
    const written = dynamo.putItem.mock.calls[0]?.[1];
    expect(written.values).toEqual({ 'smus.domainId': 'dzd_stored', 'planner.modelId': 'grok-4' });
    expect(written.updatedBy).toBe('rob@example.com');
    expect(snapshot.groups[1]?.settings.find((x) => x.key === 'planner.modelId')).toMatchObject({
      value: 'grok-4',
      source: 'stored',
    });
  });

  it('refuses an invalid update before touching the table', async () => {
    const s = store();
    await expect(s.save({ 'planner.apiKey': 'k' }, 'rob')).rejects.toThrow('secret');
    expect(dynamo.putItem).not.toHaveBeenCalled();
  });
});
