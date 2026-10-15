/**
 * The part of an export document that is the asset's definition, with the
 * fields that change on every read taken out, and a hash of it. Two exports
 * of an untouched asset hash the same, so a version is kept only when
 * someone changed something.
 *
 * Dashboards and analyses: the DescribeXDefinition response (Definition,
 * Name, ThemeArn, publish options). Datasets: the DescribeDataSet response
 * (physical and logical tables, columns, import mode, permissions config).
 */
import { createHash } from 'node:crypto';

import type { AssetType } from '../../types/assetTypes';

export type VersionedAssetType = Extract<AssetType, 'dashboard' | 'analysis' | 'dataset'>;

const VERSIONED_TYPES: ReadonlySet<AssetType> = new Set<AssetType>([
  'dashboard',
  'analysis',
  'dataset',
]);

export function isVersionedType(assetType: AssetType): assetType is VersionedAssetType {
  return VERSIONED_TYPES.has(assetType);
}

/** Fields that differ between two reads of the same, unchanged asset. */
const VOLATILE_FIELDS = new Set([
  'RequestId',
  'ResponseMetadata',
  '$metadata',
  'Status',
  'ResourceStatus',
  'Errors',
  'CreatedTime',
  'LastUpdatedTime',
  'LastPublishedTime',
  'ConsumedSpiceCapacityInBytes',
]);

export interface DefinitionSnapshot {
  /** The definition response, volatile fields removed, keys in a fixed order. */
  definition: Record<string, unknown>;
  hash: string;
  name: string;
  /** QuickSight's own version number, when the response carries one. */
  quickSightVersion?: number;
}

/** The same object with keys sorted at every level, so equal content prints the same. */
export function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const inner = (value as Record<string, unknown>)[key];
      if (inner !== undefined) out[key] = stable(inner);
    }
    return out;
  }
  return value;
}

function withoutVolatile(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutVolatile);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as object)) {
      if (VOLATILE_FIELDS.has(key)) continue;
      out[key] = withoutVolatile(inner);
    }
    return out;
  }
  return value;
}

export function definitionHash(definition: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(definition)))
    .digest('hex');
}

/** The raw definition response inside an export document, or null when it has none. */
function definitionOfExport(
  assetType: VersionedAssetType,
  exportData: any
): Record<string, unknown> | null {
  const entry =
    assetType === 'dataset'
      ? exportData?.apiResponses?.describe
      : exportData?.apiResponses?.definition;
  const data = entry?.data;
  if (!data || typeof data !== 'object') return null;
  if (assetType !== 'dataset' && !data.Definition) return null;
  return data as Record<string, unknown>;
}

/**
 * What an export document says the asset is, as the one thing worth keeping
 * a version of. Null when the document carries no definition (an export
 * that fetched only permissions, an uploaded-file dataset).
 */
export function snapshotOf(
  assetType: VersionedAssetType,
  exportData: any
): DefinitionSnapshot | null {
  const raw = definitionOfExport(assetType, exportData);
  if (!raw) return null;
  const definition = stable(withoutVolatile(raw)) as Record<string, unknown>;
  const list = exportData?.apiResponses?.list?.data ?? {};
  const name = String(raw.Name ?? list.Name ?? '');
  const version = (raw as any).Version?.VersionNumber ?? list.Version?.VersionNumber;
  return {
    definition,
    hash: definitionHash(definition),
    name,
    ...(typeof version === 'number' ? { quickSightVersion: version } : {}),
  };
}
