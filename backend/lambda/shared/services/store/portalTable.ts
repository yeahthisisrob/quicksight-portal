/**
 * The portal's DynamoDB table and every entity in it, modelled with
 * ElectroDB. This is the one place the portal talks to DynamoDB: each store
 * (jobs, settings, API keys, audit, the library, the catalog) reads and
 * writes through the entities here, so keys, casing and item shapes are
 * defined once.
 *
 * Every change is a single-item write (put, patch, update, conditional
 * delete), so two writers never undo each other: there is no shared
 * document to read, change and write back.
 *
 * Keys keep their case (`casing: 'none'`): QuickSight ids and job ids are
 * case-sensitive, and ElectroDB lowercases keys unless told not to.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Entity, type EntityItem, Service } from 'electrodb';

import { getOptimizedAwsConfig } from '../../config/httpConfig';

/** The table's name: set by the stack; the account-named default serves local runs. */
function portalTableName(env: NodeJS.ProcessEnv = process.env): string {
  return env.PORTAL_TABLE_NAME || `quicksight-portal-${env.AWS_ACCOUNT_ID || ''}`;
}

const keep = { casing: 'none' } as const;
const service = 'portal';

/** A job the worker runs: its status, progress, checkpoint and result. */
const job = new Entity({
  model: { entity: 'job', version: '1', service },
  attributes: {
    jobId: { type: 'string', required: true },
    jobType: { type: 'string', required: true },
    status: { type: 'string', required: true },
    startTime: { type: 'string', required: true },
    progress: { type: 'number' },
    message: { type: 'string' },
    lastUpdatedTime: { type: 'string' },
    endTime: { type: 'string' },
    duration: { type: 'number' },
    userId: { type: 'string' },
    startedBy: { type: 'string' },
    accountId: { type: 'string' },
    assetType: { type: 'string' },
    assetId: { type: 'string' },
    deploymentType: { type: 'string' },
    exportOptions: { type: 'any' },
    playbook: { type: 'any' },
    stats: { type: 'any' },
    phases: { type: 'any' },
    checkpoint: { type: 'any' },
    error: { type: 'string' },
    errorStack: { type: 'string' },
    failures: { type: 'any' },
    stopRequested: { type: 'boolean' },
    result: { type: 'any' },
    expiresAt: { type: 'number' },
  },
  indexes: {
    byId: {
      pk: { field: 'pk', composite: ['jobId'], ...keep },
      sk: { field: 'sk', composite: [], ...keep },
    },
    byStartTime: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: [], ...keep },
      sk: { field: 'gsi1sk', composite: ['startTime'], ...keep },
    },
  },
});

/** One line of a job's log; `logKey` orders lines (time, then a sequence). */
const jobLog = new Entity({
  model: { entity: 'jobLog', version: '1', service },
  attributes: {
    jobId: { type: 'string', required: true },
    logKey: { type: 'string', required: true },
    timestamp: { type: 'string', required: true },
    level: { type: 'string', required: true },
    message: { type: 'string', required: true },
    details: { type: 'any' },
    expiresAt: { type: 'number' },
  },
  indexes: {
    byJob: {
      pk: { field: 'pk', composite: ['jobId'], ...keep },
      sk: { field: 'sk', composite: ['logKey'], ...keep },
    },
  },
});

/** One thing a job works through (a playbook's asset), in stage order by `itemKey`. */
const jobItem = new Entity({
  model: { entity: 'jobItem', version: '1', service },
  attributes: {
    jobId: { type: 'string', required: true },
    itemKey: { type: 'string', required: true },
    stage: { type: 'number', required: true },
    assetType: { type: 'string', required: true },
    assetId: { type: 'string', required: true },
    name: { type: 'string', required: true },
    status: { type: 'string', required: true },
    verdict: { type: 'string' },
    summary: { type: 'string' },
    changes: { type: 'any' },
    warnings: { type: 'any' },
    error: { type: 'string' },
    attempts: { type: 'number' },
    updatedAt: { type: 'string', required: true },
    plan: { type: 'any' },
    expiresAt: { type: 'number' },
  },
  indexes: {
    byJob: {
      pk: { field: 'pk', composite: ['jobId'], ...keep },
      sk: { field: 'sk', composite: ['itemKey'], ...keep },
    },
  },
});

/** The single-export lock: who holds it and until when. */
const exportLock = new Entity({
  model: { entity: 'exportLock', version: '1', service },
  attributes: {
    lock: { type: 'string', required: true },
    ownerJobId: { type: 'string', required: true },
    acquiredAt: { type: 'string', required: true },
    lockExpiresAt: { type: 'number', required: true },
    expiresAt: { type: 'number' },
  },
  indexes: {
    byLock: {
      pk: { field: 'pk', composite: ['lock'], ...keep },
      sk: { field: 'sk', composite: [], ...keep },
    },
  },
});

/** One stored setting: a key, its value, and who set it when. One item each, so saves never collide. */
const setting = new Entity({
  model: { entity: 'setting', version: '1', service },
  attributes: {
    key: { type: 'string', required: true },
    value: { type: 'any', required: true },
    updatedAt: { type: 'string', required: true },
    updatedBy: { type: 'string', required: true },
  },
  indexes: {
    byKey: {
      pk: { field: 'pk', composite: [], ...keep },
      sk: { field: 'sk', composite: ['key'], ...keep },
    },
  },
});

/** A key for machine callers; only the secret's SHA-256 is stored. */
const apiKey = new Entity({
  model: { entity: 'apiKey', version: '1', service },
  attributes: {
    id: { type: 'string', required: true },
    label: { type: 'string', required: true },
    prefix: { type: 'string', required: true },
    createdAt: { type: 'string', required: true },
    createdBy: { type: 'string', required: true },
    hash: { type: 'string', required: true },
    lastUsedAt: { type: 'string' },
  },
  indexes: {
    byId: {
      pk: { field: 'pk', composite: [], ...keep },
      sk: { field: 'sk', composite: ['id'], ...keep },
    },
  },
});

/** A write the portal made to QuickSight, and who was behind it. Newest last by `at`. */
const auditRecord = new Entity({
  model: { entity: 'auditRecord', version: '1', service },
  attributes: {
    id: { type: 'string', required: true },
    at: { type: 'string', required: true },
    actor: { type: 'any', required: true },
    channel: { type: 'string', required: true },
    action: { type: 'string', required: true },
    assetType: { type: 'string' },
    assetId: { type: 'string' },
    assetName: { type: 'string' },
    jobId: { type: 'string' },
    details: { type: 'any' },
    expiresAt: { type: 'number' },
  },
  indexes: {
    byTime: {
      pk: { field: 'pk', composite: [], ...keep },
      sk: { field: 'sk', composite: ['at', 'id'], ...keep },
    },
  },
});

/** The kinds of thing the organisation saves for reuse. */
const LIBRARY_KINDS = ['calculated-field', 'filter-bar', 'visual', 'playbook'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

/** A saved template or playbook: its shared facts, and the kind's own fields in `body`. */
const libraryItem = new Entity({
  model: { entity: 'libraryItem', version: '1', service },
  attributes: {
    kind: { type: LIBRARY_KINDS, required: true },
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    description: { type: 'string' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string', required: true },
    updatedAt: { type: 'string', required: true },
    body: { type: 'any', required: true },
  },
  indexes: {
    byKind: {
      pk: { field: 'pk', composite: ['kind'], ...keep },
      sk: { field: 'sk', composite: ['id'], ...keep },
    },
  },
});

/**
 * One asset in the catalog, live or archived (a restored asset keeps its
 * archived row as the ledger's record, so both can exist for one id).
 * A type's entries are spread over `shard`s: an export writes thousands of
 * one type at once, and one partition key takes 1,000 write units a second.
 * `metadata` is gzip+base64: a large dashboard's fields and a large group's
 * members would otherwise approach the 400 KB item limit.
 */
const catalogEntry = new Entity({
  model: { entity: 'catalogEntry', version: '1', service },
  attributes: {
    assetType: { type: 'string', required: true },
    shard: { type: 'number', required: true },
    state: { type: ['live', 'archived'] as const, required: true },
    assetId: { type: 'string', required: true },
    assetName: { type: 'string', required: true },
    arn: { type: 'string' },
    status: { type: 'string', required: true },
    enrichmentStatus: { type: 'string', required: true },
    createdTime: { type: 'string' },
    lastUpdatedTime: { type: 'string' },
    exportedAt: { type: 'string' },
    enrichedAt: { type: 'string' },
    enrichmentTimestamps: { type: 'any' },
    exportFilePath: { type: 'string', required: true },
    storageType: { type: 'string', required: true },
    tags: { type: 'any' },
    permissions: { type: 'any' },
    metadataGz: { type: 'string' },
    /** Changes on every write: an update applies only if it is still the revision it read. */
    rev: { type: 'string', required: true },
  },
  indexes: {
    byType: {
      pk: { field: 'pk', composite: ['assetType', 'shard'], ...keep },
      sk: { field: 'sk', composite: ['state', 'assetId'], ...keep },
    },
  },
});

/** A type's catalog version: bumped on every change, so a Lambda knows when its copy is stale. */
const catalogVersion = new Entity({
  model: { entity: 'catalogVersion', version: '1', service },
  attributes: {
    assetType: { type: 'string', required: true },
    version: { type: 'number', required: true, default: 0 },
    updatedAt: { type: 'string' },
  },
  indexes: {
    byType: {
      pk: { field: 'pk', composite: ['assetType'], ...keep },
      sk: { field: 'sk', composite: [], ...keep },
    },
  },
});

const ENTITIES = {
  job,
  jobLog,
  jobItem,
  exportLock,
  setting,
  apiKey,
  auditRecord,
  libraryItem,
  catalogEntry,
  catalogVersion,
};

export type PortalEntities = typeof ENTITIES;
export type JobRow = EntityItem<typeof job>;
export type JobItemRow = EntityItem<typeof jobItem>;
export type CatalogEntryRow = EntityItem<typeof catalogEntry>;

let instance: Service<PortalEntities> | null = null;

/** The service: the entities bound to the table (one per process), and transactions across them. */
export function portalService(): Service<PortalEntities> {
  if (!instance) {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient(getOptimizedAwsConfig()), {
      marshallOptions: { removeUndefinedValues: true },
    });
    instance = new Service(ENTITIES, { client, table: portalTableName() });
  }
  return instance;
}

/** The entities, bound to the table. */
export function portal(): Service<PortalEntities>['entities'] {
  return portalService().entities;
}

/** Tests bind the entities to their own client and table (an in-process DynamoDB). */
export function bindPortal(client: DynamoDBDocumentClient, table: string): void {
  instance = new Service(ENTITIES, { client, table });
}

/** True when a conditional write found the item not as required. */
export function isConditionFailed(error: unknown): boolean {
  const e = error as { name?: string; cause?: { name?: string }; message?: string };
  return (
    e?.name === 'ConditionalCheckFailedException' ||
    e?.cause?.name === 'ConditionalCheckFailedException' ||
    /conditional request failed/i.test(e?.message ?? '')
  );
}
