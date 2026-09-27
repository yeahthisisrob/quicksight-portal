/**
 * The bucket the portal keeps its exports, archive, caches and reports in.
 * The stack sets BUCKET_NAME; the fallback is the name the stack gives it.
 */
export function metadataBucketName(accountId = process.env.AWS_ACCOUNT_ID || ''): string {
  return process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;
}
