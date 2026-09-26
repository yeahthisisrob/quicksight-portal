/**
 * AssetRestoreService - bring an archived dataset or data source back.
 *
 * Dashboards and analyses restore through authoring (the Studio edits them
 * first). A dataset or data source has nothing to edit, so it is checked,
 * then created from the archived record: every check says what it found and
 * whether it blocks, and nothing is written over anything - the id must be
 * free in QuickSight.
 *
 * - dataset: the archive must hold its describe (an uploaded file cannot be
 *   created through the API), and every data source it reads must exist;
 *   its data prep configuration, row- and column-level security, usage
 *   configuration and refresh schedules come back with it.
 * - data source: only types QuickSight connects to without stored
 *   credentials (Athena, S3, Timestream) or with a Secrets Manager secret can
 *   come back; the export never keeps passwords.
 *
 * Either way the archived audience comes back less users and groups deleted
 * since, with the person restoring it as owner; tags come back; the archive
 * records the restore; the cache learns of it at once.
 */
import { type AuthContext, actorLabel } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ArchiveService } from '../../../shared/services/archive/ArchiveService';
import { actorFromAuth, auditLog } from '../../../shared/services/audit/AuditLog';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { keepCacheFresh } from '../../../shared/services/cache/assetFreshness';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { quickSightUserFor } from '../../../shared/services/identity/IdentityResolver';
import { keepLivePrincipals } from '../../../shared/services/identity/livePrincipals';
import { logger } from '../../../shared/utils/logger';
import {
  DATASET_OWNER_ACTIONS,
  normalizePermissionsArray,
} from '../../../shared/utils/permissions';
import { reviveQuickSightTimestamps } from '../../../shared/utils/quicksightTimestamps';

export type RestorableSourceType = 'dataset' | 'datasource';

interface RestoreCheck {
  label: string;
  ok: boolean;
  /** A failed check that blocks the restore (as opposed to a warning). */
  blocking: boolean;
  detail: string;
}

export interface RestorePreview {
  assetType: RestorableSourceType;
  assetId: string;
  name: string;
  canRestore: boolean;
  checks: RestoreCheck[];
}

export interface SourceRestoreResult {
  assetType: RestorableSourceType;
  assetId: string;
  name: string;
  arn: string;
  warnings: string[];
}

/** Data source types QuickSight reaches through its own role, needing no stored credentials. */
const NO_CREDENTIALS = new Set(['ATHENA', 'S3', 'TIMESTREAM', 'AWS_IOT_ANALYTICS']);

const DATASOURCE_OWNER_ACTIONS = [
  'quicksight:DescribeDataSource',
  'quicksight:DescribeDataSourcePermissions',
  'quicksight:PassDataSource',
  'quicksight:UpdateDataSource',
  'quicksight:DeleteDataSource',
  'quicksight:UpdateDataSourcePermissions',
];

interface ArchivedSource {
  describe: Record<string, any>;
  permissions: any[];
  tags: Array<{ key: string; value: string }>;
  refreshSchedules: any[];
}

const isNotFound = (error: any) =>
  error?.name === 'ResourceNotFoundException' ||
  error?.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND;

function idFromArn(arn: string): string {
  return arn.split('/').pop() ?? arn;
}

/** Every data source a dataset's physical tables read through. */
function dataSourceArns(describe: Record<string, any>): string[] {
  const arns = Object.values(describe.PhysicalTableMap ?? {}).flatMap((table: any) =>
    [
      table?.RelationalTable?.DataSourceArn,
      table?.CustomSql?.DataSourceArn,
      table?.S3Source?.DataSourceArn,
    ].filter((a): a is string => typeof a === 'string')
  );
  return [...new Set(arns)];
}

export class AssetRestoreService {
  private readonly archive: ArchiveService;

  public constructor(private readonly quickSight: QuickSightService) {
    const bucketName = process.env.BUCKET_NAME || 'quicksight-metadata-bucket';
    this.archive = new ArchiveService(bucketName, cacheService);
  }

  private async loadArchived(assetType: RestorableSourceType, assetId: string) {
    const record = await this.archive.getArchivedAsset(assetType, assetId);
    if (!record) {
      throw new ValidationError(`There is no archived ${assetType} '${assetId}'`);
    }
    const describe = record.apiResponses?.describe?.data;
    const rawTags: any[] = Array.isArray(record.apiResponses?.tags?.data)
      ? record.apiResponses.tags.data
      : [];
    const archived: ArchivedSource | null = describe
      ? {
          describe: reviveQuickSightTimestamps(describe),
          permissions: normalizePermissionsArray(record.apiResponses?.permissions?.data),
          tags: rawTags
            .map((t) => ({
              key: String(t.key ?? t.Key ?? ''),
              value: String(t.value ?? t.Value ?? ''),
            }))
            .filter((t) => t.key && !t.key.startsWith('portal:')),
          refreshSchedules: Array.isArray(record.apiResponses?.refreshSchedules?.data)
            ? record.apiResponses.refreshSchedules.data
            : [],
        }
      : null;
    const name =
      describe?.Name ??
      record.apiResponses?.list?.data?.Name ??
      record.apiResponses?.list?.data?.name ??
      assetId;
    return { archived, name: String(name) };
  }

  private async idIsFree(assetType: RestorableSourceType, assetId: string): Promise<boolean> {
    try {
      const found =
        assetType === 'dataset'
          ? await this.quickSight.describeDataset(assetId)
          : await this.quickSight.describeDatasource(assetId);
      return !found;
    } catch (error) {
      if (isNotFound(error)) return true;
      throw error;
    }
  }

  public async preview(
    assetType: RestorableSourceType,
    assetId: string,
    newAssetId?: string
  ): Promise<RestorePreview> {
    const { archived, name } = await this.loadArchived(assetType, assetId);
    const checks: RestoreCheck[] = [];
    const targetId = newAssetId?.trim() || assetId;

    checks.push(
      archived
        ? {
            label: 'Archived definition',
            ok: true,
            blocking: true,
            detail: 'The archive holds its full definition.',
          }
        : {
            label: 'Archived definition',
            ok: false,
            blocking: true,
            detail:
              assetType === 'dataset'
                ? 'The archive has no definition for it (an uploaded file cannot be created through the API).'
                : 'The archive has no definition for it.',
          }
    );

    const free = await this.idIsFree(assetType, targetId);
    checks.push({
      label: 'Id',
      ok: free,
      blocking: true,
      detail: free
        ? `'${targetId}' is free in QuickSight.`
        : `A ${assetType} with id '${targetId}' exists in QuickSight; restore it under a new id.`,
    });

    if (archived && assetType === 'dataset') {
      for (const arn of dataSourceArns(archived.describe)) {
        const id = idFromArn(arn);
        let exists = false;
        try {
          exists = Boolean(await this.quickSight.describeDatasource(id));
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
        checks.push({
          label: `Data source ${id}`,
          ok: exists,
          blocking: true,
          detail: exists
            ? 'It still exists.'
            : 'It no longer exists; restore it first (it may be in the archive) or the dataset has nothing to read.',
        });
      }
    }

    if (archived && assetType === 'datasource') {
      const type = String(archived.describe.Type ?? '');
      const hasSecret = Boolean(archived.describe.SecretArn);
      const fine = NO_CREDENTIALS.has(type) || hasSecret;
      checks.push({
        label: 'Credentials',
        ok: fine,
        blocking: true,
        detail: fine
          ? hasSecret
            ? 'It connects through its Secrets Manager secret.'
            : `${type} needs no stored credentials.`
          : `${type} needs a user name and password the export never keeps; recreate it in QuickSight.`,
      });
    }

    if (archived) {
      const live = await keepLivePrincipals(archived.permissions);
      checks.push({
        label: 'Audience',
        ok: live.dropped.length === 0,
        blocking: false,
        detail:
          archived.permissions.length === 0
            ? 'The archive kept no audience; only you will own it until it is shared.'
            : live.dropped.length === 0
              ? `${archived.permissions.length} principals come back.`
              : live.warnings.join(' '),
      });
    }

    return {
      assetType,
      assetId,
      name,
      canRestore: checks.every((c) => c.ok || !c.blocking),
      checks,
    };
  }

  public async restore(
    assetType: RestorableSourceType,
    assetId: string,
    request: { newAssetId?: string; name?: string },
    auth?: AuthContext
  ): Promise<SourceRestoreResult> {
    const preview = await this.preview(assetType, assetId, request.newAssetId);
    if (!preview.canRestore) {
      const blockers = preview.checks.filter((c) => !c.ok && c.blocking).map((c) => c.detail);
      throw new ValidationError(`It cannot be restored: ${blockers.join(' ')}`);
    }
    const { archived } = await this.loadArchived(assetType, assetId);
    if (!archived) {
      throw new ValidationError('The archive has no definition for it');
    }
    const targetId = request.newAssetId?.trim() || assetId;
    const name = request.name?.trim() || preview.name;
    const warnings: string[] = [];

    const live = await keepLivePrincipals(archived.permissions);
    warnings.push(...live.warnings);
    const permissions = await this.withOwner(
      live.permissions,
      assetType === 'dataset' ? DATASET_OWNER_ACTIONS : DATASOURCE_OWNER_ACTIONS,
      auth
    );

    const d = archived.describe;
    const created =
      assetType === 'dataset'
        ? await this.quickSight.createDataSet({
            dataSetId: targetId,
            name,
            physicalTableMap: d.PhysicalTableMap,
            logicalTableMap: d.LogicalTableMap,
            importMode: d.ImportMode,
            permissions,
            tags: archived.tags.length > 0 ? archived.tags : undefined,
            columnGroups: d.ColumnGroups,
            fieldFolders: d.FieldFolders,
            rowLevelPermissionDataSet: d.RowLevelPermissionDataSet,
            rowLevelPermissionTagConfiguration: d.RowLevelPermissionTagConfiguration,
            columnLevelPermissionRules: d.ColumnLevelPermissionRules,
            dataSetUsageConfiguration: d.DataSetUsageConfiguration,
            datasetParameters: d.DatasetParameters,
            dataPrepConfiguration: d.DataPrepConfiguration,
            semanticModelConfiguration: d.SemanticModelConfiguration,
          })
        : await this.quickSight.createDataSource({
            dataSourceId: targetId,
            name,
            type: d.Type,
            dataSourceParameters: d.DataSourceParameters,
            ...(d.SecretArn ? { credentials: { SecretArn: d.SecretArn } } : {}),
            permissions,
            tags: archived.tags.length > 0 ? archived.tags : undefined,
            vpcConnectionProperties: d.VpcConnectionProperties,
            sslProperties: d.SslProperties,
          });

    if (assetType === 'dataset') {
      for (const schedule of archived.refreshSchedules) {
        try {
          const { Arn: _arn, ...rest } = schedule;
          await this.quickSight.createRefreshSchedule(targetId, rest);
        } catch (error: any) {
          warnings.push(
            `Refresh schedule ${schedule.ScheduleId ?? ''} could not be put back: ${error?.message ?? 'unknown error'}.`
          );
        }
      }
    }

    await this.archive.markRestored(assetType, assetId, {
      restoredAt: new Date().toISOString(),
      restoredBy: auth ? actorLabel(auth) : 'the portal',
      restoredAs: targetId,
    });
    await keepCacheFresh([{ assetType, assetId: targetId, name, arn: created.arn }], {
      accountId: auth?.accountId,
      userId: auth?.userId,
    });
    if (auth) {
      const { actor, channel } = actorFromAuth(auth);
      await auditLog.record({
        actor,
        channel,
        action: 'asset.restore',
        assetType,
        assetId: targetId,
        assetName: name,
        details: { restoredFrom: assetId },
      });
    }
    logger.info('Restored archived asset', { assetType, assetId, targetId });

    return { assetType, assetId: targetId, name, arn: created.arn, warnings };
  }

  /** The restorer owns what they bring back: their QuickSight user, by email, gets owner actions. */
  private async withOwner(permissions: any[], actions: string[], auth?: AuthContext) {
    const owner = await quickSightUserFor(auth?.email);
    const list = permissions.map((p) => ({ ...p, Actions: [...(p.Actions ?? [])] }));
    if (owner) {
      const existing = list.find((p) => p.Principal === owner.arn);
      if (existing) {
        existing.Actions = [...new Set([...existing.Actions, ...actions])];
      } else {
        list.push({ Principal: owner.arn, Actions: actions });
      }
    }
    return list.length > 0 ? list : undefined;
  }
}
