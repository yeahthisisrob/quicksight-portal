/**
 * An asset's export record is written whole, but a run does not always
 * fetch everything: a permissions-only or tags-only refresh, a caller that
 * switches permissions or tags off, a fetch that came back with nothing.
 * Whatever this run did not fetch is carried forward from the record it
 * replaces, so a write never loses permissions, tags, a definition or a
 * describe the previous export captured. That record is also what the
 * archive keeps when the asset is deleted, and what a restore reads.
 */
import type { AssetExportData } from '../../../shared/models/asset-export.model';

/** The listing is always this run's; everything else may be carried. */
const ALWAYS_FRESH = new Set(['list']);

export function carryForward(
  next: AssetExportData,
  previous: AssetExportData | null | undefined
): AssetExportData {
  const earlier = previous?.apiResponses as Record<string, unknown> | undefined;
  if (!earlier) {
    return next;
  }
  const current = next.apiResponses as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(earlier)) {
    if (!ALWAYS_FRESH.has(key) && current[key] === undefined && value !== undefined) {
      merged[key] = value;
    }
  }
  return { ...next, apiResponses: merged as AssetExportData['apiResponses'] };
}

/** S3 says the object is not there (as opposed to failing to read it). */
export function isMissingObject(error: unknown): boolean {
  const e = error as { name?: string; message?: string; Code?: string } | null;
  const name = e?.name ?? e?.Code ?? '';
  const message = e?.message ?? '';
  return (
    name === 'NoSuchKey' ||
    name === 'NotFound' ||
    message.includes('NoSuchKey') ||
    message.includes('does not exist')
  );
}
