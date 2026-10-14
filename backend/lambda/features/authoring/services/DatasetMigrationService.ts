/**
 * A legacy dataset moved to the new data prep experience.
 *
 * QuickSight has no in-place upgrade: a dataset built with a LogicalTableMap
 * cannot be opened in the new data prep, cannot be the parent of a
 * new-experience dataset, and UpdateDataSet will not switch it. So the
 * migration is a twin: a new dataset with the same physical tables, the
 * logical tables rewritten as the new pipeline, the same import mode,
 * permissions, tags, folders, field folders, column groups and refresh
 * schedules, owned by the person who ran it. Every dashboard and analysis
 * reading the old one can be repointed in the same call (a rebind of
 * identical columns, so nothing downstream changes). The old dataset stays
 * until someone deletes it: nothing here is destructive.
 *
 * The preview says what the twin would carry, what it would leave behind,
 * and why it cannot be built when it cannot; the migration writes exactly
 * what the preview showed.
 */
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../../../shared/auth';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { describeDataSetForEdit, ingestionIdOf } from '../../../shared/services/aws/datasetUpdate';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { catalog } from '../../../shared/services/catalog/catalogStore';
import {
  dataPrepFromLegacy,
  type LegacyConversion,
  withColumnIds,
} from '../../../shared/services/datasets/dataPrep';
import type { LineageService } from '../../../shared/services/lineage/LineageService';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { normalizePermissionsArray } from '../../../shared/utils/permissions';
import { type DatasetReader, datasetReaders } from '../lib/datasetReaders';
import { recordProvenance, tagsForCreate } from './assetWriter';
import { audienceFor, fileInFolders } from './audience';
import type { RebindService } from './RebindService';

export interface DatasetMigrationRequest {
  /** The twin's name; the original's when omitted. */
  name?: string;
  newDataSetId?: string;
  /** Repoint every dashboard and analysis reading the original at the twin. */
  rebindReaders?: boolean;
}

export interface DatasetMigrationPreview {
  dataSetId: string;
  name: string;
  importMode: string;
  /** Which data prep experience the dataset is in now. */
  experience: 'legacy' | 'dataPrep';
  /** What the twin carries, what it leaves behind, and why it cannot be built. */
  carried: string[];
  dropped: string[];
  refused: string[];
  /** The dashboards and analyses reading the dataset, which a migration can repoint. */
  readers: Array<Pick<DatasetReader, 'assetType' | 'assetId' | 'name'>>;
  /** The folders the twin will be filed in: the original's and the defaults from Settings. */
  folderIds: string[];
  warnings: string[];
}

export interface DatasetMigrationResult extends DatasetMigrationPreview {
  assetType: 'dataset';
  /** The twin. */
  assetId: string;
  arn: string;
  owner?: string;
  /** SPICE: the twin's first import. */
  ingestionId?: string;
  /** Each reader repointed at the twin, or why it was not. */
  rebound: Array<
    Pick<DatasetReader, 'assetType' | 'assetId' | 'name'> & { ok: boolean; error?: string }
  >;
}

/** Provenance tags belong to the twin's own write, not the original's. */
const PROVENANCE_TAG = /^portal:/;

interface Composed {
  described: Record<string, any>;
  conversion: LegacyConversion;
  readers: DatasetReader[];
  preview: DatasetMigrationPreview;
}

export class DatasetMigrationService {
  private readonly quickSight: QuickSightService;

  public constructor(
    accountId: string,
    private readonly rebind: Pick<RebindService, 'describeDatasets' | 'apply'>,
    private readonly lineage?: LineageService
  ) {
    this.quickSight = ClientFactory.getQuickSightService(accountId);
  }

  public async preview(dataSetId: string, auth?: AuthContext): Promise<DatasetMigrationPreview> {
    return (await this.compose(dataSetId, auth)).preview;
  }

  public async migrate(
    dataSetId: string,
    request: DatasetMigrationRequest,
    auth?: AuthContext
  ): Promise<DatasetMigrationResult> {
    const { described, conversion, readers, preview } = await this.compose(dataSetId, auth);
    if (preview.refused.length > 0) {
      throw new ValidationError(
        `This dataset cannot be migrated as it is: ${preview.refused.join(' ')}`
      );
    }
    const name = request.name?.trim() || preview.name;
    const newDataSetId = request.newDataSetId?.trim() || randomUUID();
    const [permissions, oldTags] = await Promise.all([
      this.quickSight.describeDatasetPermissions(dataSetId).then(normalizePermissionsArray),
      this.quickSight.getResourceTags(ASSET_TYPES.dataset, dataSetId).catch((error) => {
        logger.warn('Tags of the original could not be read', { dataSetId, error });
        preview.warnings.push(
          'The tags of the original could not be read, so the twin has only the defaults.'
        );
        return [] as Array<{ key: string; value: string }>;
      }),
    ]);
    const audience = await audienceFor(
      'dataset',
      permissions.length > 0 ? permissions : undefined,
      auth
    );
    preview.warnings.push(...audience.warnings);
    const tags = tagsForCreate(
      newDataSetId,
      oldTags.filter((t) => !PROVENANCE_TAG.test(t.key)),
      auth
    );
    logger.info('Migrating dataset to the new data prep experience', {
      dataSetId,
      newDataSetId,
      steps: Object.keys(conversion.dataPrepConfiguration.TransformStepMap).length,
      readers: readers.length,
      rebindReaders: request.rebindReaders === true,
    });

    const created = await this.quickSight.createDataSet({
      dataSetId: newDataSetId,
      name,
      // Every column needs an id in the new experience; the legacy ones have none.
      physicalTableMap: withColumnIds(described.PhysicalTableMap),
      importMode: described.ImportMode,
      permissions: audience.permissions?.length ? audience.permissions : undefined,
      ...(tags.length > 0 ? { tags } : {}),
      columnGroups: described.ColumnGroups,
      fieldFolders: described.FieldFolders,
      columnLevelPermissionRules: described.ColumnLevelPermissionRules,
      dataSetUsageConfiguration: described.DataSetUsageConfiguration,
      datasetParameters: described.DatasetParameters,
      dataPrepConfiguration: conversion.dataPrepConfiguration,
      semanticModelConfiguration: conversion.semanticModelConfiguration,
    });

    const warnings = [...preview.warnings];
    for (const schedule of await this.refreshSchedulesOf(dataSetId, warnings)) {
      try {
        const { Arn: _arn, ...rest } = schedule;
        await this.quickSight.createRefreshSchedule(created.dataSetId, rest);
      } catch (error: any) {
        warnings.push(
          `Refresh schedule ${schedule.ScheduleId ?? ''} could not be copied: ${error?.message ?? 'unknown error'}.`
        );
      }
    }
    const folderIds = [...new Set([...preview.folderIds, ...audience.folderIds])];
    const { filed, warnings: filing } = await fileInFolders(
      this.quickSight,
      folderIds,
      created.dataSetId,
      'dataset'
    );
    warnings.push(...filing);
    await recordProvenance(
      this.quickSight,
      {
        action: 'authoring.create',
        assetType: 'dataset',
        assetId: created.dataSetId,
        arn: created.arn,
        name,
        folderIds: filed,
        details: { migratedFrom: dataSetId, carried: conversion.carried },
      },
      auth
    );

    const rebound: DatasetMigrationResult['rebound'] = [];
    if (request.rebindReaders) {
      for (const reader of readers) {
        try {
          await this.rebind.apply(
            reader.assetType,
            reader.assetId,
            {
              mode: 'update',
              rebinds: [{ identifier: reader.identifier, targetDataSetId: created.dataSetId }],
            },
            auth
          );
          rebound.push({
            assetType: reader.assetType,
            assetId: reader.assetId,
            name: reader.name,
            ok: true,
          });
        } catch (error: any) {
          logger.warn('A reader could not be repointed at the migrated dataset', { reader, error });
          rebound.push({
            assetType: reader.assetType,
            assetId: reader.assetId,
            name: reader.name,
            ok: false,
            error: error?.message ?? 'unknown error',
          });
        }
      }
    }
    const ingestionId = ingestionIdOf(created.ingestionArn);
    return {
      ...preview,
      name,
      folderIds: filed,
      warnings,
      assetType: 'dataset',
      assetId: created.dataSetId,
      arn: created.arn,
      ...(audience.owner ? { owner: audience.owner.userName } : {}),
      ...(ingestionId ? { ingestionId } : {}),
      rebound,
    };
  }

  private async compose(dataSetId: string, _auth?: AuthContext): Promise<Composed> {
    const described = await describeDataSetForEdit(this.quickSight, dataSetId);
    const name = String(described.Name ?? dataSetId);
    const warnings: string[] = [];
    if (described.DataPrepConfiguration) {
      const conversion = dataPrepFromLegacy({});
      return {
        described,
        conversion,
        readers: [],
        preview: {
          dataSetId,
          name,
          importMode: String(described.ImportMode),
          experience: 'dataPrep',
          carried: [],
          dropped: [],
          refused: ['The dataset is already in the new data prep experience.'],
          readers: [],
          folderIds: [],
          warnings,
        },
      };
    }
    const conversion = dataPrepFromLegacy(described);
    const [{ readers, unreadable }, entry] = await Promise.all([
      datasetReaders(dataSetId, this.rebind, this.lineage),
      catalog.get(ASSET_TYPES.dataset, dataSetId),
    ]);
    for (const u of unreadable) {
      warnings.push(
        `${u.assetType} ${u.name} reads it but could not be read, so it will not be repointed.`
      );
    }
    const folderIds = (Array.isArray(entry?.metadata?.folderPath) ? entry.metadata.folderPath : [])
      .filter((arn: unknown): arn is string => typeof arn === 'string')
      .map((arn: string) => arn.slice(arn.lastIndexOf('/') + 1))
      .filter(Boolean);
    return {
      described,
      conversion,
      readers,
      preview: {
        dataSetId,
        name,
        importMode: String(described.ImportMode),
        experience: 'legacy',
        carried: conversion.carried,
        dropped: conversion.dropped,
        refused: conversion.refused,
        readers: readers.map(({ assetType, assetId, name: readerName }) => ({
          assetType,
          assetId,
          name: readerName,
        })),
        folderIds,
        warnings,
      },
    };
  }

  private async refreshSchedulesOf(dataSetId: string, warnings: string[]): Promise<any[]> {
    try {
      const schedules = await this.quickSight.listRefreshSchedules(dataSetId);
      return Array.isArray(schedules) ? schedules : [];
    } catch (error: any) {
      logger.warn('Refresh schedules of the original could not be read', { dataSetId, error });
      warnings.push(
        'The refresh schedules of the original could not be read, so none were copied.'
      );
      return [];
    }
  }
}
