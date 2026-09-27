/**
 * What a deleted user had, kept so it can be given back: the groups they
 * were in and the permissions granted to them directly (dashboards,
 * analyses, datasets, data sources, folders). QuickSight keys all of it to
 * the user's ARN, and a reader who signs in again through the identity
 * provider gets the same ARN, so restoring is re-adding and re-granting.
 * What QuickSight keeps per person (bookmarks, subscriptions) is not here.
 */
import { metadataBucketName } from '../../../shared/config/metadataBucket';
import { S3Service } from '../../../shared/services/aws/S3Service';

export interface ArchivedUser {
  userName: string;
  email?: string;
  role: string;
  arn: string;
  archivedAt: string;
  archivedBy?: string;
  groups: string[];
  permissions: Array<{ assetType: string; assetId: string; assetName: string; actions: string[] }>;
  restoredAt?: string;
  restoredBy?: string;
}

const keyOf = (userName: string) => `archived/users/${encodeURIComponent(userName)}.json`;

export class UserArchive {
  private readonly s3: S3Service;
  private readonly bucket: string;

  public constructor(accountId: string) {
    this.s3 = new S3Service(accountId);
    this.bucket = metadataBucketName(accountId);
  }

  public async save(user: ArchivedUser): Promise<void> {
    await this.s3.putObject(this.bucket, keyOf(user.userName), user);
  }

  /** The archived user, or null when none was kept. */
  public async get(userName: string): Promise<ArchivedUser | null> {
    if (!(await this.s3.objectExists(this.bucket, keyOf(userName)))) return null;
    return await this.s3.getObject<ArchivedUser>(this.bucket, keyOf(userName));
  }
}
