import { describe, expect, it, vi } from 'vitest';

import { EXAMPLE_SPECS } from '../../catalog/examples';
import { type PlaybookContext, PortalCallError } from '../../types';
import { specPlaybook } from '../specPlaybook';
import { validateSpec } from '../validateSpec';

const example = EXAMPLE_SPECS.find((s) => s.id === 'remove-idle-readers')!;
const playbook = specPlaybook(example);
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

interface UserRow {
  id: string;
  name: string;
  role: string;
  groups?: string[];
  assetAccessCount?: number;
  activity?: { lastActive: string | null };
}

const ROWS: UserRow[] = [
  // Idle, alone, reaching nothing: goes.
  { id: 'idle', name: 'idle', role: 'READER', groups: [], assetAccessCount: 0 },
  // Only in the everyone group, reaching only through it and an all-readers folder: goes when both are ignored.
  {
    id: 'everyone',
    name: 'everyone',
    role: 'READER',
    groups: ['All Readers'],
    assetAccessCount: 2,
  },
  // In a real group: stays.
  { id: 'grouped', name: 'grouped', role: 'READER', groups: ['finance'], assetAccessCount: 0 },
  // Shared a dashboard directly: stays.
  { id: 'direct', name: 'direct', role: 'READER', groups: [], assetAccessCount: 1 },
  // Active last week: stays.
  {
    id: 'active',
    name: 'active',
    role: 'READER',
    groups: [],
    assetAccessCount: 0,
    activity: { lastActive: daysAgo(7) },
  },
  // An author: never selected.
  { id: 'author', name: 'author', role: 'AUTHOR', groups: [], assetAccessCount: 0 },
  // The list could not enrich it: not known is not "none".
  { id: 'unknown', name: 'unknown', role: 'READER' },
];

function portal(options: { coverageDays?: number; refreshedDaysAgo?: number } = {}) {
  const deleted: string[] = [];
  const call = vi.fn(async (method: string, path: string) => {
    const p = decodeURIComponent(new URL(path, 'http://x').pathname);
    if (p === '/api/assets/users/paginated') {
      return { users: ROWS, pagination: { totalPages: 1 } };
    }
    if (p === '/api/users/everyone/asset-access') {
      return {
        assets: [
          { sources: [{ type: 'group', groupName: 'All Readers' }] },
          { sources: [{ type: 'folder', folderName: 'Shared', folderPath: '/Company/Shared' }] },
        ],
      };
    }
    if (p === '/api/users/direct/asset-access') {
      return { assets: [{ sources: [{ type: 'direct' }] }] };
    }
    if (p === '/api/activity/coverage') {
      return {
        start: daysAgo(options.coverageDays ?? 120),
        end: daysAgo(0),
        lastUpdated: daysAgo(options.refreshedDaysAgo ?? 0),
        days: options.coverageDays ?? 120,
      };
    }
    if (p.startsWith('/api/activity/user/')) throw new PortalCallError(404, 'no activity');
    if (method === 'DELETE' && p.startsWith('/api/users/')) {
      deleted.push(p.slice('/api/users/'.length));
      return { success: true, message: `User "${p.slice(11)}" deleted successfully` };
    }
    throw new PortalCallError(404, `${method} ${p}`);
  });
  return { call, deleted };
}

const ctx = (call: unknown, params: Record<string, unknown> = {}) =>
  ({ call, params: { days: 90, ...params } }) as unknown as PlaybookContext;

describe('remove idle readers', () => {
  it('selects readers in no group and reaching nothing, and never an unknown row', async () => {
    const { call } = portal();
    const targets = await playbook.scope(ctx(call));
    expect(targets.map((t) => t.assetId)).toEqual(['idle']);
    // Users carry no edit time for the "edited recently" gate.
    expect(targets[0]).not.toHaveProperty('lastUpdatedTime');
  });

  it('ignores the groups and folders it is told do not count, never direct access', async () => {
    const { call } = portal();
    const targets = await playbook.scope(
      ctx(call, { ignoreGroups: 'all readers', ignoreFolders: '/Company/Shared' })
    );
    expect(targets.map((t) => t.assetId).sort()).toEqual(['everyone', 'idle']);
  });

  it('deletes after a last look, and holds back when the activity cannot vouch for it', async () => {
    const target = { assetType: 'user' as const, assetId: 'idle', name: 'idle' };
    const { call, deleted } = portal();
    const plan = await playbook.plan(ctx(call), target);
    expect(plan.verdict).toBe('change');
    await playbook.apply(ctx(call), target, plan);
    expect(deleted).toEqual(['idle']);

    const short = await playbook.plan(ctx(portal({ coverageDays: 30 }).call), target);
    expect(short.verdict).toBe('review');
    expect(short.summary).toContain('covers 30 days');

    const stale = await playbook.plan(ctx(portal({ refreshedDaysAgo: 5 }).call), target);
    expect(stale.verdict).toBe('review');
    expect(stale.summary).toContain('refresh it first');
  });

  it('is a playbook that deletes and writes to users', () => {
    expect(playbook.deletes).toBe(true);
    expect(playbook.writes).toEqual(['user']);
  });
});

describe('validating user specs', () => {
  const base = {
    name: 'x',
    inputs: [],
    select: { assetTypes: ['user'], where: [{ kind: 'role', roles: 'READER' }] },
    steps: [{ kind: 'deleteUser', inactiveDays: 90 }],
  };

  it('accepts the shipped example', () => {
    expect(() => validateSpec(example as unknown as Record<string, unknown>)).not.toThrow();
  });

  it('keeps users and assets apart', () => {
    expect(() =>
      validateSpec({ ...base, select: { ...base.select, assetTypes: ['user', 'dashboard'] } })
    ).toThrow('users are selected on their own');
    expect(() =>
      validateSpec({
        ...base,
        select: { assetTypes: ['user'], where: [{ kind: 'views', min: 1 }] },
      })
    ).toThrow('does not apply to users');
    expect(() =>
      validateSpec({
        ...base,
        select: { assetTypes: ['dashboard'], where: [{ kind: 'inactiveForDays', days: 90 }] },
      })
    ).toThrow('applies only to users');
    expect(() =>
      validateSpec({ ...base, select: { assetTypes: ['dashboard'], where: [] } })
    ).toThrow('applies only to users');
    expect(() => validateSpec({ ...base, steps: [{ kind: 'repair' }] })).toThrow(
      'does not apply to users'
    );
  });
});
