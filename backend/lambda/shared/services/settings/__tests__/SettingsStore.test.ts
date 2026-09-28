import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { portal } from '../../store/portalTable';
import { SettingsStore } from '../SettingsStore';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

async function seed(): Promise<void> {
  const { data } = await portal().setting.query.byKey({}).go({ pages: 'all' });
  if (data.length)
    await portal()
      .setting.delete(data.map(({ key }) => ({ key })))
      .go();
  await portal()
    .setting.put([
      {
        key: 'smus.domainId',
        value: 'dzd_stored',
        updatedAt: '2026-09-18T00:00:00Z',
        updatedBy: 'rob',
      },
      {
        key: 'smus.projectIds',
        value: ['p1'],
        updatedAt: '2026-09-17T00:00:00Z',
        updatedBy: 'pat',
      },
    ])
    .go();
}

describe('SettingsStore', () => {
  beforeEach(seed);

  it('reads every stored setting and resolves stored over env', async () => {
    const s = new SettingsStore({ SMUS_DOMAIN_ID: 'dzd_env', SMUS_DOMAIN_REGION: 'eu-west-1' });
    await s.load();
    expect(s.getString('smus.domainId')).toBe('dzd_stored');
    expect(s.getString('smus.region')).toBe('eu-west-1');
    expect(s.getList('smus.projectIds')).toEqual(['p1']);
    // The last save's author and time.
    expect(s.snapshot().updatedBy).toBe('rob');
  });

  it('caches within the TTL and refreshes when forced', async () => {
    const s = new SettingsStore({});
    await s.load();
    await portal()
      .setting.put({ key: 'smus.domainId', value: 'dzd_new', updatedAt: 'z', updatedBy: 'x' })
      .go();
    await s.load();
    expect(s.getString('smus.domainId')).toBe('dzd_stored');
    await s.load(true);
    expect(s.getString('smus.domainId')).toBe('dzd_new');
  });

  it('writes only the keys it changes, clearing nulls and empties', async () => {
    const s = new SettingsStore({});
    const snapshot = await s.save(
      { 'smus.projectIds': null, 'planner.modelId': 'grok-4', 'smus.portalUrl': '' },
      'rob@example.com'
    );
    expect(s.stored()).toEqual({ 'smus.domainId': 'dzd_stored', 'planner.modelId': 'grok-4' });
    expect(snapshot.updatedBy).toBe('rob@example.com');
    expect(snapshot.groups[1]?.settings.find((x) => x.key === 'planner.modelId')).toMatchObject({
      value: 'grok-4',
      source: 'stored',
    });
  });

  it('keeps both of two saves made at once to different settings', async () => {
    await Promise.all([
      new SettingsStore({}).save({ 'planner.modelId': 'grok-4' }, 'rob'),
      new SettingsStore({}).save({ 'smus.portalUrl': 'https://portal.example.com' }, 'pat'),
    ]);
    const s = new SettingsStore({});
    await s.load();
    expect(s.stored()).toMatchObject({
      'planner.modelId': 'grok-4',
      'smus.portalUrl': 'https://portal.example.com',
      'smus.domainId': 'dzd_stored',
    });
  });

  it('refuses an invalid update before touching the table', async () => {
    const s = new SettingsStore({});
    await expect(s.save({ 'planner.apiKey': 'k' }, 'rob')).rejects.toThrow('secret');
    await s.load(true);
    expect(s.stored()).not.toHaveProperty('planner.apiKey');
  });

  it('keeps running from the environment when the table cannot be read', async () => {
    const s = new SettingsStore({ SMUS_DOMAIN_ID: 'dzd_env' });
    vi.spyOn(portal().setting.query, 'byKey').mockImplementationOnce(() => {
      throw new Error('no table');
    });
    await expect(s.load()).resolves.toBeUndefined();
    expect(s.getString('smus.domainId')).toBe('dzd_env');
    expect(s.snapshot().groups[0]?.settings[0]?.source).toBe('env');
  });
});
