/**
 * One-time: copy what people made from the old jobs table into the portal
 * table - settings (one item per key now), API keys, the audit log, and the
 * library (calculated-field, filter-bar and visual templates, saved
 * playbooks). Jobs are not copied: they expire and the next run makes new
 * ones. The catalog is not copied either: an export fills it from S3.
 *
 *   just migrate-portal-table            (AWS_ACCOUNT_ID and credentials from the shell)
 *
 * Safe to run again: every write is a put of the same item.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, paginateScan } from '@aws-sdk/lib-dynamodb';

import { type LibraryKind, portal } from '../shared/services/store/portalTable';

const account = process.env.AWS_ACCOUNT_ID;
if (!account) throw new Error('Set AWS_ACCOUNT_ID');
const OLD_TABLE = `quicksight-portal-jobs-${account}`;

const LIBRARY: Record<string, LibraryKind> = {
  CALC_TEMPLATE: 'calculated-field',
  FILTER_BAR_TEMPLATE: 'filter-bar',
  VISUAL_TEMPLATE: 'visual',
  PLAYBOOK_SPEC: 'playbook',
};

type OldItem = Record<string, any> & { pk: string; sk: string };

async function* oldItems(): AsyncGenerator<OldItem> {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  for await (const page of paginateScan({ client }, { TableName: OLD_TABLE })) {
    yield* (page.Items ?? []) as OldItem[];
  }
}

async function copy(item: OldItem): Promise<string | null> {
  const { pk, sk: _sk, ...rest } = item;
  if (pk === 'SETTINGS') {
    const at = rest.updatedAt ?? new Date().toISOString();
    const by = rest.updatedBy ?? 'migration';
    const settings = Object.entries(rest.values ?? {}).map(([key, value]) => ({
      key,
      value,
      updatedAt: at,
      updatedBy: by,
    }));
    if (settings.length > 0) await portal().setting.put(settings).go();
    return 'settings item';
  }
  if (pk === 'API_KEY') {
    const { id, label, prefix, createdAt, createdBy, hash, lastUsedAt } = rest;
    await portal().apiKey.put({ id, label, prefix, createdAt, createdBy, hash, lastUsedAt }).go();
    return 'api key';
  }
  if (pk === 'AUDIT') {
    const { ttl, ...record } = rest;
    await portal()
      .auditRecord.put({ ...(record as any), expiresAt: ttl })
      .go();
    return 'audit record';
  }
  const kind = LIBRARY[pk];
  if (kind) {
    const { id, name, description, createdBy, createdAt, updatedAt, ...body } = rest;
    await portal()
      .libraryItem.put({ kind, id, name, description, createdBy, createdAt, updatedAt, body })
      .go();
    return kind;
  }
  return null;
}

async function main(): Promise<void> {
  const copied = new Map<string, number>();
  let skipped = 0;
  for await (const item of oldItems()) {
    const what = await copy(item);
    if (what) copied.set(what, (copied.get(what) ?? 0) + 1);
    else skipped++;
  }
  console.log(
    `From ${OLD_TABLE}:`,
    Object.fromEntries(copied),
    `(${skipped} job items left behind)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
