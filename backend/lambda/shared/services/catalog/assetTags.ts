/**
 * An asset's tags as the portal records them after a tag change in
 * QuickSight: on its catalog entry, and on its export document so the next
 * rebuild keeps them. Each is one conditional change, so a tag change never
 * undoes another write to the same entry or document.
 */
import { metadataBucketName } from '../../config/metadataBucket';
import type { AssetType } from '../../models/asset.model';
import { isCollectionType } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { S3Service } from '../aws/S3Service';
import { exportFilePath } from './catalogEntry';
import { catalog } from './catalogStore';

type Tags = Array<{ key: string; value: string }>;

let s3: S3Service | null = null;
const s3Service = () => (s3 ??= new S3Service(process.env.AWS_ACCOUNT_ID || ''));

/** The document with the asset's tags replaced (a collection holds the asset under its id). */
function withTags(
  document: any,
  assetType: AssetType,
  assetId: string,
  tags: Tags,
  at: string
): any {
  const stamp = (record: any) =>
    record && {
      ...record,
      apiResponses: { ...record.apiResponses, tags: { timestamp: at, data: tags } },
      enrichmentTimestamps: { ...record.enrichmentTimestamps, tags: at },
    };
  if (!isCollectionType(assetType)) return stamp(document);
  return document?.[assetId] ? { ...document, [assetId]: stamp(document[assetId]) } : undefined;
}

export async function recordAssetTags(
  assetType: AssetType,
  assetId: string,
  tags: Tags
): Promise<void> {
  const now = new Date();
  await catalog.patch(assetType, assetId, { tags, enrichmentTimestamps: { tags: now } });
  try {
    await s3Service().updateObject(
      metadataBucketName(),
      exportFilePath(assetType, assetId, 'live'),
      (document) =>
        document ? withTags(document, assetType, assetId, tags, now.toISOString()) : undefined
    );
  } catch (error) {
    // The catalog has the tags; the next export writes them to the document.
    logger.warn(`Could not record the tags in the export of ${assetType}/${assetId}`, { error });
  }
}
