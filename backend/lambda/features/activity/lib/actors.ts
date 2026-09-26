/**
 * Who an activity event's actor is, in words a person recognises.
 *
 * CloudTrail records the portal's own writes under its Lambda role, as
 * "RoleName/FunctionName". Those show as "Portal", and the audit log says
 * who was behind them. Other assumed roles show their role and session,
 * IAM users their name, and QuickSight users their QuickSight name.
 */

import { TIME_UNITS } from '../../../shared/constants/timeConstants';
import type { AuditRecord } from '../../../shared/services/audit/AuditLog';

type ActorKind = 'portal' | 'user' | 'role' | 'root' | 'service' | 'unknown';
export type EventOrigin =
  | 'portal-ui'
  | 'portal-api'
  | 'portal'
  | 'console'
  | 'automation'
  | 'unknown';

export interface ActorDescription {
  kind: ActorKind;
  /** Short: "Portal", "rob@example.com", "AdminRole / rob". */
  label: string;
  /** The raw actor string, for tooltips and filters. */
  raw: string;
}

export interface Provenance {
  actor: AuditRecord['actor'];
  channel: AuditRecord['channel'];
  action: string;
  jobId?: string;
  /** How far the audit record was from the event, in ms; small means confident. */
  distanceMs: number;
}

export interface PortalIdentity {
  /** The Lambda function names (session names in CloudTrail) the portal runs as. */
  functionNames: string[];
  /** A prefix every portal function and role shares, e.g. the stack name. */
  stackPrefix?: string;
}

/** From the Lambda environment: the stack prefix is the part before the construct id. */
export function portalIdentityFromEnv(env: NodeJS.ProcessEnv = process.env): PortalIdentity {
  const fn = env.AWS_LAMBDA_FUNCTION_NAME ?? '';
  const stackPrefix = fn.includes('-') ? fn.slice(0, fn.indexOf('-')) : undefined;
  return { functionNames: fn ? [fn] : [], stackPrefix };
}

const ROLE_SESSION = /^([^/]+)\/(.+)$/;

export function describeActor(raw: string, portal: PortalIdentity): ActorDescription {
  const value = (raw ?? '').trim();
  if (!value) {
    return { kind: 'unknown', label: 'Unknown', raw: value };
  }
  const roleSession = ROLE_SESSION.exec(value);
  if (roleSession) {
    const [, role, session] = roleSession;
    const isPortal =
      portal.functionNames.includes(session!) ||
      (portal.stackPrefix !== undefined &&
        role!.startsWith(portal.stackPrefix) &&
        session!.startsWith(portal.stackPrefix)) ||
      (role!.includes('LambdaExecutionRole') && /Lambda/.test(session!));
    if (isPortal) {
      return { kind: 'portal', label: 'Portal', raw: value };
    }
    // An SSO session looks like AWSReservedSSO_Admin_abc123/rob@example.com.
    const roleLabel = role!.replace(/^AWSReservedSSO_/, '').replace(/_[0-9a-f]{8,}$/i, '');
    return { kind: 'role', label: `${roleLabel} / ${session}`, raw: value };
  }
  if (value === 'root' || value.endsWith(':root')) {
    return { kind: 'root', label: 'Account root', raw: value };
  }
  if (value.endsWith('.amazonaws.com')) {
    return { kind: 'service', label: value.replace(/\.amazonaws\.com$/, ''), raw: value };
  }
  return {
    kind: 'user',
    label: value.includes('/') ? value.slice(value.lastIndexOf('/') + 1) : value,
    raw: value,
  };
}

/** How close an audit record must be to a CloudTrail event to be its cause. */
const MATCH_WINDOW_MS = 10 * TIME_UNITS.MINUTE;

/**
 * The audit record that explains a portal event: same asset, closest in
 * time within the window. Records are consumed once so a burst of events
 * on one asset does not all point at the same write.
 */
export function matchProvenance(
  event: { timestamp: string; assetId?: string; assetType?: string },
  records: AuditRecord[],
  used: Set<string> = new Set()
): Provenance | null {
  if (!event.assetId) {
    return null;
  }
  const t = Date.parse(event.timestamp);
  let best: { record: AuditRecord; distance: number } | null = null;
  for (const record of records) {
    if (used.has(record.id) || record.assetId !== event.assetId) {
      continue;
    }
    if (event.assetType && record.assetType && record.assetType !== event.assetType) {
      continue;
    }
    const distance = Math.abs(Date.parse(record.at) - t);
    if (distance <= MATCH_WINDOW_MS && (!best || distance < best.distance)) {
      best = { record, distance };
    }
  }
  if (!best) {
    return null;
  }
  used.add(best.record.id);
  return {
    actor: best.record.actor,
    channel: best.record.channel,
    action: best.record.action,
    jobId: best.record.jobId,
    distanceMs: best.distance,
  };
}

export function originOf(actor: ActorDescription, provenance: Provenance | null): EventOrigin {
  if (actor.kind === 'portal') {
    if (!provenance) {
      return 'portal';
    }
    return provenance.channel === 'api' ? 'portal-api' : 'portal-ui';
  }
  if (actor.kind === 'user' || actor.kind === 'role' || actor.kind === 'root') {
    return 'console';
  }
  if (actor.kind === 'service') {
    return 'automation';
  }
  return 'unknown';
}
