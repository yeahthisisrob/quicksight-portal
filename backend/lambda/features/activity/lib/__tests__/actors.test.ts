import { describe, expect, it } from 'vitest';

import {
  describeActor,
  matchProvenance,
  originOf,
  portalIdentityFromEnv,
  type PortalIdentity,
} from '../actors';

const portal: PortalIdentity = {
  functionNames: ['QuicksightPortalStack-ApiLambda1A2B3C'],
  stackPrefix: 'QuicksightPortalStack',
};

describe('portalIdentityFromEnv', () => {
  it('derives the stack prefix from the Lambda function name', () => {
    expect(
      portalIdentityFromEnv({ AWS_LAMBDA_FUNCTION_NAME: 'QuicksightPortalStack-WorkerLambdaF00' })
    ).toEqual({ functionNames: ['QuicksightPortalStack-WorkerLambdaF00'], stackPrefix: 'QuicksightPortalStack' });
    expect(portalIdentityFromEnv({})).toEqual({ functionNames: [], stackPrefix: undefined });
  });
});

describe('describeActor', () => {
  it("names the portal's own Lambda role 'Portal' whichever function ran", () => {
    expect(
      describeActor('QuicksightPortalStack-LambdaExecutionRole7E2A/QuicksightPortalStack-ApiLambda1A2B3C', portal)
    ).toMatchObject({ kind: 'portal', label: 'Portal' });
    expect(
      describeActor('QuicksightPortalStack-LambdaExecutionRole7E2A/QuicksightPortalStack-WorkerLambdaF00', portal)
    ).toMatchObject({ kind: 'portal' });
    // Even with no env hints, a Lambda execution role running a Lambda is the portal.
    expect(
      describeActor('Stack-LambdaExecutionRoleXYZ/Stack-ApiLambda9', { functionNames: [] })
    ).toMatchObject({ kind: 'portal' });
  });

  it('shortens an SSO role session to role and person', () => {
    expect(describeActor('AWSReservedSSO_AdministratorAccess_0123456789abcdef/rob@example.com', portal)).toEqual({
      kind: 'role',
      label: 'AdministratorAccess / rob@example.com',
      raw: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/rob@example.com',
    });
  });

  it('recognises users, root and services', () => {
    expect(describeActor('rob', portal)).toMatchObject({ kind: 'user', label: 'rob' });
    expect(describeActor('arn:aws:iam::123:root', portal)).toMatchObject({ kind: 'root' });
    expect(describeActor('quicksight.amazonaws.com', portal)).toMatchObject({ kind: 'service', label: 'quicksight' });
    expect(describeActor('', portal)).toMatchObject({ kind: 'unknown' });
  });
});

describe('matchProvenance and originOf', () => {
  const records = [
    {
      id: 'a1',
      at: '2026-09-19T10:00:00.000Z',
      actor: { kind: 'api-key' as const, id: 'k1', label: 'claude cli' },
      channel: 'api' as const,
      action: 'authoring.update',
      assetType: 'dashboard',
      assetId: 'd-1',
    },
    {
      id: 'a2',
      at: '2026-09-19T10:00:30.000Z',
      actor: { kind: 'user' as const, id: 'u1', label: 'rob@example.com' },
      channel: 'ui' as const,
      action: 'asset.rename',
      assetType: 'dashboard',
      assetId: 'd-1',
    },
  ];

  it('picks the closest record on the same asset within the window, and consumes it', () => {
    const used = new Set<string>();
    const first = matchProvenance({ timestamp: '2026-09-19T10:00:05.000Z', assetId: 'd-1', assetType: 'dashboard' }, records, used);
    expect(first).toMatchObject({ actor: { label: 'claude cli' }, channel: 'api', distanceMs: 5000 });
    const second = matchProvenance({ timestamp: '2026-09-19T10:00:06.000Z', assetId: 'd-1', assetType: 'dashboard' }, records, used);
    expect(second).toMatchObject({ actor: { label: 'rob@example.com' } });
    expect(matchProvenance({ timestamp: '2026-09-19T10:00:07.000Z', assetId: 'd-1' }, records, used)).toBeNull();
  });

  it('ignores other assets and anything outside the window', () => {
    expect(matchProvenance({ timestamp: '2026-09-19T10:00:05.000Z', assetId: 'd-2' }, records)).toBeNull();
    expect(matchProvenance({ timestamp: '2026-09-19T11:00:00.000Z', assetId: 'd-1' }, records)).toBeNull();
    expect(matchProvenance({ timestamp: '2026-09-19T10:00:05.000Z' }, records)).toBeNull();
  });

  it('turns actor and provenance into an origin', () => {
    const portalActor = describeActor('S-LambdaExecutionRole/S-ApiLambda', { functionNames: [] });
    expect(originOf(portalActor, null)).toBe('portal');
    expect(originOf(portalActor, { actor: records[0]!.actor, channel: 'api', action: 'x', distanceMs: 0 })).toBe('portal-api');
    expect(originOf(portalActor, { actor: records[1]!.actor, channel: 'ui', action: 'x', distanceMs: 0 })).toBe('portal-ui');
    expect(originOf(describeActor('rob', portal), null)).toBe('console');
    expect(originOf(describeActor('quicksight.amazonaws.com', portal), null)).toBe('automation');
    expect(originOf(describeActor('', portal), null)).toBe('unknown');
  });
});
