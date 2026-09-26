/**
 * AuditLog - the portal's own record of every write it makes to QuickSight.
 * CloudTrail only ever sees the portal's Lambda role for those, so this is
 * the one place that knows who was behind it: a signed-in person through
 * the UI, or an API key (which is what an agent runs as). The timeline
 * enriches the role's events from these records.
 *
 * Stored in the jobs table under one partition, newest first by sort key.
 */
import { randomUUID } from 'node:crypto';

import { type AuthContext, actorLabel } from '../../auth';
import { TIME_UNITS } from '../../constants/timeConstants';
import { logger } from '../../utils/logger';
import { DynamoDBService } from '../aws/DynamoDBService';

const AUDIT_PK = 'AUDIT';
const ID_LENGTH = 8;
/** Records older than this are dropped by the table's TTL attribute. */
const RETENTION_DAYS = 400;
const DEFAULT_LIST_LIMIT = 500;

export type AuditChannel = 'ui' | 'api';

export interface AuditActor {
  kind: 'user' | 'api-key';
  /** The user id or the key id. */
  id: string;
  /** What to show: an email, or the key's label. */
  label: string;
}

export interface AuditRecord {
  id: string;
  at: string;
  actor: AuditActor;
  channel: AuditChannel;
  /** A short verb phrase: "authoring.apply", "asset.rename", "bulk.delete". */
  action: string;
  assetType?: string;
  assetId?: string;
  assetName?: string;
  jobId?: string;
  details?: Record<string, unknown>;
}

interface StoredAudit extends AuditRecord {
  pk: string;
  sk: string;
  ttl: number;
}

/** The actor and channel behind a request, from its auth context. */
export function actorFromAuth(auth: AuthContext): { actor: AuditActor; channel: AuditChannel } {
  if (auth.apiKey) {
    return {
      actor: { kind: 'api-key', id: auth.apiKey.id, label: auth.apiKey.label },
      channel: 'api',
    };
  }
  return {
    actor: { kind: 'user', id: auth.userId, label: actorLabel(auth) },
    channel: 'ui',
  };
}

export class AuditLog {
  private readonly tableName: string;

  public constructor(
    private readonly dynamo: DynamoDBService = new DynamoDBService(),
    tableName?: string,
    private readonly now: () => Date = () => new Date()
  ) {
    const env = process.env;
    this.tableName =
      tableName || env.JOBS_TABLE_NAME || `quicksight-portal-jobs-${env.AWS_ACCOUNT_ID || ''}`;
  }

  /** Never throws: a failed audit write must not fail the write it describes. */
  public async record(entry: Omit<AuditRecord, 'id' | 'at'>): Promise<AuditRecord | null> {
    const at = this.now();
    const record: AuditRecord = {
      id: randomUUID().slice(0, ID_LENGTH),
      at: at.toISOString(),
      ...entry,
    };
    const item: StoredAudit = {
      pk: AUDIT_PK,
      sk: `${record.at}#${record.id}`,
      ttl: Math.floor((at.getTime() + RETENTION_DAYS * TIME_UNITS.DAY) / TIME_UNITS.SECOND),
      ...record,
    };
    try {
      await this.dynamo.putItem(this.tableName, item);
      return record;
    } catch (error) {
      logger.warn('Audit record could not be written', { action: entry.action, error });
      return null;
    }
  }

  /** Records in [since, until], newest first. */
  public async list(range: {
    since: string;
    until?: string;
    limit?: number;
  }): Promise<AuditRecord[]> {
    const items = await this.dynamo.queryPartition<StoredAudit>(this.tableName, 'pk', AUDIT_PK, {
      sortKeyBeginsWith: undefined,
      limit: range.limit ?? DEFAULT_LIST_LIMIT,
    });
    const until = range.until ?? this.now().toISOString();
    return items
      .filter((i) => i.at >= range.since && i.at <= until)
      .map(({ pk: _pk, sk: _sk, ttl: _ttl, ...record }) => record)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
}

export const auditLog = new AuditLog();
