/**
 * Who someone is, from whatever a record kept of them: an email, a Cognito
 * sign-in id (the `sub` older job and archive records hold), an API key's
 * label, or a QuickSight user name. People are named by email where the
 * user pool knows one and linked to their QuickSight user when one matches;
 * failing both, the pool's username, and only then the id itself.
 */
import { CognitoAdapter, type CognitoPerson } from '../../../adapters/aws/CognitoAdapter';
import { TIME_UNITS } from '../../constants';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { logger } from '../../utils/logger';
import { cacheService } from '../cache/CacheService';

export interface Person {
  /** How to show them: an email, an API key's label, a user name. */
  label: string;
  email?: string;
  /** Their QuickSight user, when one matches (by email or user name). */
  quickSightUserName?: string;
  quickSightUserArn?: string;
  kind: 'person' | 'api-key' | 'portal';
}

interface QuickSightUser {
  userName: string;
  arn: string;
  email?: string;
}

const SUB = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_KEY_PREFIX = 'api-key:';
const API_KEY_SUFFIX = ' (API key)';
const PORTAL = new Set(['', 'system', 'the portal', 'portal']);
const SUB_TTL_MS = TIME_UNITS.HOUR;

/** Sign-in ids already looked up in this container: they do not change owner. */
const subs = new Map<string, { person: CognitoPerson | null; at: number }>();

let adapter: CognitoAdapter | null | undefined;
function cognito(): CognitoAdapter | null {
  if (adapter === undefined) {
    const pool = process.env.COGNITO_USER_POOL_ID;
    adapter = pool ? new CognitoAdapter(pool, process.env.AWS_REGION || 'us-east-1') : null;
  }
  return adapter;
}

async function lookUpSub(sub: string): Promise<CognitoPerson | null> {
  const known = subs.get(sub);
  if (known && Date.now() - known.at < SUB_TTL_MS) {
    return known.person;
  }
  const pool = cognito();
  if (!pool) {
    return null;
  }
  try {
    const person = await pool.findBySub(sub);
    subs.set(sub, { person, at: Date.now() });
    return person;
  } catch (error) {
    logger.warn('Could not look up a sign-in id in the user pool', { error });
    return null;
  }
}

async function quickSightUsers(): Promise<QuickSightUser[]> {
  try {
    const users = await cacheService.getCacheEntries({
      assetType: 'user',
      statusFilter: AssetStatusFilter.ACTIVE,
    });
    return users
      .filter((u: any) => u.arn)
      .map((u: any) => ({
        userName: String(u.assetName ?? u.assetId),
        arn: String(u.arn),
        ...(u.metadata?.email ? { email: String(u.metadata.email) } : {}),
      }));
  } catch (error) {
    logger.warn('QuickSight users could not be read to name people', { error });
    return [];
  }
}

function matchUser(users: QuickSightUser[], email?: string, userName?: string) {
  const wanted = email?.trim().toLowerCase();
  return (
    (wanted && users.find((u) => u.email?.trim().toLowerCase() === wanted)) ||
    (userName && users.find((u) => u.userName === userName)) ||
    undefined
  );
}

/** The QuickSight user whose email is this one, from the export cache. */
export async function quickSightUserFor(
  email: string | undefined
): Promise<{ userName: string; arn: string } | undefined> {
  if (!email?.trim()) return undefined;
  const user = matchUser(await quickSightUsers(), email);
  return user ? { userName: user.userName, arn: user.arn } : undefined;
}

/**
 * Resolve many references at once (one read of the QuickSight users; each
 * sign-in id looked up once). References that are empty are left out.
 */
export async function resolvePeople(refs: Array<string | undefined>): Promise<Map<string, Person>> {
  const unique = [...new Set(refs.filter((r): r is string => typeof r === 'string'))];
  const out = new Map<string, Person>();
  if (unique.length === 0) {
    return out;
  }
  const users = await quickSightUsers();
  await Promise.all(
    unique.map(async (ref) => {
      const trimmed = ref.trim();
      if (PORTAL.has(trimmed.toLowerCase())) {
        out.set(ref, { label: 'The portal', kind: 'portal' });
        return;
      }
      if (trimmed.startsWith(API_KEY_PREFIX) || trimmed.endsWith(API_KEY_SUFFIX)) {
        const label = trimmed.startsWith(API_KEY_PREFIX)
          ? trimmed.slice(API_KEY_PREFIX.length)
          : trimmed.slice(0, -API_KEY_SUFFIX.length);
        out.set(ref, { label: `${label}${API_KEY_SUFFIX}`, kind: 'api-key' });
        return;
      }
      let email = trimmed.includes('@') ? trimmed : undefined;
      let fallback = trimmed;
      if (!email && SUB.test(trimmed)) {
        const signIn = await lookUpSub(trimmed);
        email = signIn?.email;
        fallback = signIn?.name ?? signIn?.username ?? trimmed;
      }
      const user = matchUser(users, email, email ? undefined : fallback);
      out.set(ref, {
        label: email ?? user?.userName ?? fallback,
        kind: 'person',
        ...(email ? { email } : {}),
        ...(user ? { quickSightUserName: user.userName, quickSightUserArn: user.arn } : {}),
      });
    })
  );
  return out;
}

/** For tests: forget looked-up sign-ins and the pool client. */
export function resetIdentityCache(): void {
  subs.clear();
  adapter = undefined;
}
