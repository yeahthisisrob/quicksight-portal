/**
 * Put an earlier version of a dashboard, analysis or dataset back: the
 * definition the history kept for that version is written over the live
 * asset, as a new version (the rollback is itself a change, recorded with
 * who did it and which version came back). Nothing is deleted: the history
 * keeps every version, the one just rolled back from included.
 */
import { type AuthContext, actorLabel } from '../../../shared/auth';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { auditLog } from '../../../shared/services/audit/AuditLog';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { resendDataSet } from '../../../shared/services/aws/datasetUpdate';
import { keepCatalogFresh } from '../../../shared/services/catalog/assetFreshness';
import {
  type AssetHistory,
  assetHistory,
  versionMoment,
} from '../../../shared/services/history/AssetHistory';
import type { VersionedAssetType } from '../../../shared/services/history/definitionSnapshot';
import { logger } from '../../../shared/utils/logger';
import { recordProvenance, updateAsset } from './assetWriter';

export interface RollbackResult {
  assetType: VersionedAssetType;
  assetId: string;
  name: string;
  /** The version put back. */
  versionId: string;
  /** When that version was kept. */
  versionAt: string;
  /** Dashboards only: the QuickSight version the rollback created. */
  versionNumber?: number;
  warnings: string[];
}

export class VersionRestoreService {
  private readonly quickSightService;

  public constructor(
    accountId: string,
    private readonly history: AssetHistory = assetHistory()
  ) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  public async restore(
    assetType: VersionedAssetType,
    assetId: string,
    versionId: string,
    auth?: AuthContext
  ): Promise<RollbackResult> {
    const version = await this.history.get(assetType, assetId, versionId);
    if (!version) {
      throw new ValidationError(`No version ${versionId} of ${assetType} ${assetId}`);
    }
    const snapshot = await this.history.snapshot(assetType, assetId, versionId);
    const definition = snapshot.definition as Record<string, any>;
    const name = String(definition.Name ?? version.name ?? assetId);
    const when = versionMoment(version.at);
    const change = `Rolled back to the version of ${when} (${version.summary})`;
    logger.info('Rolling back to a version', { assetType, assetId, versionId, by: auth?.email });

    if (assetType === 'dataset') {
      await resendDataSet(this.quickSightService, assetId, definition, { name });
      await keepCatalogFresh(
        [
          {
            assetType,
            assetId,
            name,
            provenance: {
              source: 'rollback',
              by: auth ? actorLabel(auth) : 'The portal',
              action: 'authoring.rollback',
              changes: [change],
            },
          },
        ],
        { accountId: auth?.accountId, userId: auth?.userId }
      );
      if (auth) {
        await auditLog.record({
          actor: auth.apiKey
            ? { kind: 'api-key', id: auth.apiKey.id, label: auth.apiKey.label }
            : { kind: 'user', id: auth.userId, label: actorLabel(auth) },
          channel: auth.apiKey ? 'api' : 'ui',
          action: 'authoring.rollback',
          assetType,
          assetId,
          assetName: name,
          details: { versionId, versionAt: version.at },
        });
      }
      return { assetType, assetId, name, versionId, versionAt: version.at, warnings: [] };
    }

    const written = await updateAsset(this.quickSightService, {
      assetType,
      assetId,
      name,
      definition: definition.Definition,
      themeArn: definition.ThemeArn,
      dashboardPublishOptions: definition.DashboardPublishOptions,
    });
    await recordProvenance(
      this.quickSightService,
      {
        action: 'authoring.rollback',
        assetType,
        assetId,
        name,
        arn: written.arn,
        details: { versionId, versionAt: version.at },
        changes: [{ text: change, details: { versionId } }],
      },
      auth
    );
    return {
      assetType,
      assetId,
      name,
      versionId,
      versionAt: version.at,
      ...(written.versionNumber ? { versionNumber: written.versionNumber } : {}),
      warnings: [],
    };
  }
}
