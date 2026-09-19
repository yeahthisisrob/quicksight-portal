/**
 * DatasetSourceService - read and edit where a dataset gets its data.
 *
 * A QuickSight dataset reads through its PhysicalTableMap. Each entry is one
 * of:
 *   RelationalTable  a catalog/schema/table on a data source
 *   CustomSql        a SQL query against a data source
 *   S3Source         an S3 manifest
 *
 * QuickSight has no partial-update API: UpdateDataSet replaces the whole
 * specification. So every edit here is a describe -> patch -> update round
 * trip against LIVE QuickSight (never the cache, which can be stale), exactly
 * like RenameService does for names.
 *
 * Two things are deliberately preserved untouched across an edit:
 *
 *   Columns. RelationalTable.InputColumns and CustomSql.Columns describe the
 *   shape the rest of the dataset is built on - logical tables, calculated
 *   fields and every dashboard downstream reference those names. Rewriting
 *   them here would silently break that graph, so the caller changes where the
 *   data comes from and the columns are resent as-is. If the new table or
 *   query does not actually produce those columns, QuickSight rejects the
 *   update and the error is surfaced verbatim.
 *
 *   Table identity. The PhysicalTableMap keys are referenced by
 *   LogicalTableMap, so they are never regenerated.
 *
 * A table also cannot change kind: a relational table stays relational and
 * custom SQL stays custom SQL. Switching between them changes the column
 * shape, which is a different (and destructive) operation.
 */

import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';

export type PhysicalTableKind = 'RELATIONAL' | 'CUSTOM_SQL' | 'S3';

/** One physical table, flattened for editing. */
export interface DatasetPhysicalTable {
  /** Key in PhysicalTableMap. Referenced by LogicalTableMap - never changes. */
  id: string;
  kind: PhysicalTableKind;
  /** The data source this table reads through. */
  dataSourceArn: string;
  /** Relational: the table name. Custom SQL: the query's display name. */
  name: string;
  /** Relational only. Absent for engines without a catalog concept. */
  catalog?: string;
  /** Relational only. The database for Athena-backed sources. */
  schema?: string;
  /** Custom SQL only. */
  sqlQuery?: string;
  /** How many columns are pinned to this table (informational). */
  columnCount: number;
  /** S3 tables have no schema or query to edit here. */
  editable: boolean;
}

export interface DatasetSource {
  dataSetId: string;
  name: string;
  importMode: string;
  tables: DatasetPhysicalTable[];
}

/** A change to one physical table. Omitted fields are left alone. */
export interface DatasetTableEdit {
  id: string;
  dataSourceArn?: string;
  name?: string;
  catalog?: string;
  schema?: string;
  sqlQuery?: string;
}

export interface DatasetSourceUpdate {
  /** Rename the dataset at the same time, if given. */
  name?: string;
  tables?: DatasetTableEdit[];
}

/** A data source the caller may point a table at. */
export interface DataSourceOption {
  id: string;
  name: string;
  arn: string;
  type?: string;
}

const CANNOT_DESCRIBE =
  'Could not load this dataset from QuickSight. Uploaded (flat file) datasets have no ' +
  'queryable specification and cannot be edited here.';

export class DatasetSourceService {
  private readonly quickSightService: QuickSightService;

  public constructor(accountId: string) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  /**
   * The data sources a table may be pointed at.
   *
   * Read from the cache on purpose: this is the same list the editor offers,
   * so a selection can never name something the validator will then reject.
   * Data source ARNs are only ever chosen from here - never typed - which is
   * why `updateSource` re-checks membership rather than trusting the input.
   */
  public async listDataSourceOptions(): Promise<DataSourceOption[]> {
    const entries = await cacheService.getCacheEntries({
      assetType: ASSET_TYPES.datasource,
      statusFilter: AssetStatusFilter.ACTIVE,
    });

    return entries
      .filter((entry) => Boolean(entry.arn))
      .map((entry) => ({
        id: entry.assetId,
        name: entry.assetName,
        arn: entry.arn,
        type: (entry.metadata as { dataSourceType?: string } | undefined)?.dataSourceType,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The dataset's current sources, read live from QuickSight. */
  public async getSource(dataSetId: string): Promise<DatasetSource> {
    const current = await this.describeOrThrow(dataSetId);

    const tables = Object.entries(
      (current.PhysicalTableMap ?? {}) as Record<string, Record<string, any>>
    ).map(([id, table]) => this.toView(id, table));

    return {
      dataSetId,
      name: current.Name ?? dataSetId,
      importMode: current.ImportMode,
      tables,
    };
  }

  /**
   * Apply edits and write them back to QuickSight.
   * Returns the dataset's sources as they stand afterwards.
   */
  public async updateSource(
    dataSetId: string,
    update: DatasetSourceUpdate
  ): Promise<DatasetSource> {
    const current = await this.describeOrThrow(dataSetId);
    const physicalTableMap = structuredClone(current.PhysicalTableMap) as Record<
      string,
      Record<string, any>
    >;

    const edits = update.tables ?? [];
    if (edits.length > 0) {
      const allowedArns = new Set((await this.listDataSourceOptions()).map((o) => o.arn));
      for (const edit of edits) {
        this.applyEdit(physicalTableMap, edit, allowedArns);
      }
    }

    const name = update.name?.trim() || current.Name;
    if (!name) {
      throw new ValidationError('A dataset name is required');
    }

    logger.info('Updating dataset source', {
      dataSetId,
      tablesEdited: edits.length,
      renamed: name !== current.Name,
    });

    await this.quickSightService.updateDataSet({
      dataSetId,
      name,
      physicalTableMap,
      logicalTableMap: current.LogicalTableMap,
      importMode: current.ImportMode,
      columnGroups: current.ColumnGroups,
      fieldFolders: current.FieldFolders,
      rowLevelPermissionDataSet: current.RowLevelPermissionDataSet,
      rowLevelPermissionTagConfiguration: current.RowLevelPermissionTagConfiguration,
      columnLevelPermissionRules: current.ColumnLevelPermissionRules,
      dataSetUsageConfiguration: current.DataSetUsageConfiguration,
      dataPrepConfiguration: current.DataPrepConfiguration,
      semanticModelConfiguration: current.SemanticModelConfiguration,
    });

    // Reflect the rename in listings straight away. QuickSight bumps
    // LastUpdatedTime, so the next export re-reads the asset file anyway.
    if (name !== current.Name) {
      try {
        await cacheService.updateAsset(ASSET_TYPES.dataset, dataSetId, { assetName: name });
      } catch (error) {
        logger.warn('Dataset updated but the cached name could not be refreshed', {
          dataSetId,
          error,
        });
      }
    }

    return {
      dataSetId,
      name,
      importMode: current.ImportMode,
      tables: Object.entries(physicalTableMap).map(([id, table]) => this.toView(id, table)),
    };
  }

  /** Patch one table in place, rejecting anything the kind does not allow. */
  private applyEdit(
    physicalTableMap: Record<string, Record<string, any>>,
    edit: DatasetTableEdit,
    allowedArns: Set<string>
  ): void {
    const table = physicalTableMap[edit.id];
    if (!table) {
      throw new ValidationError(`This dataset has no physical table '${edit.id}'`);
    }

    const relational = table.RelationalTable;
    const customSql = table.CustomSql;
    const target = relational ?? customSql;
    if (!target) {
      throw new ValidationError(
        `Physical table '${edit.id}' is an S3 source and cannot be edited here`
      );
    }

    if (edit.dataSourceArn !== undefined) {
      // Chosen from listDataSourceOptions, never typed - so an ARN that is not
      // in that set is a bug or a tampered request, not a user typo.
      if (!allowedArns.has(edit.dataSourceArn)) {
        throw new ValidationError(
          "The selected data source is not one of this account's data sources"
        );
      }
      target.DataSourceArn = edit.dataSourceArn;
    }

    if (edit.name !== undefined) {
      const name = edit.name.trim();
      if (!name) {
        throw new ValidationError(`A name is required for physical table '${edit.id}'`);
      }
      target.Name = name;
    }

    if (edit.sqlQuery !== undefined) {
      if (!customSql) {
        throw new ValidationError(
          `Physical table '${edit.id}' is a relational table, so it has no SQL to edit`
        );
      }
      const sql = edit.sqlQuery.trim();
      if (!sql) {
        throw new ValidationError(`The SQL for physical table '${edit.id}' cannot be empty`);
      }
      customSql.SqlQuery = sql;
    }

    if (edit.schema !== undefined || edit.catalog !== undefined) {
      if (!relational) {
        throw new ValidationError(
          `Physical table '${edit.id}' is custom SQL - change the query instead of its schema`
        );
      }
      if (edit.schema !== undefined) {
        relational.Schema = edit.schema.trim();
      }
      if (edit.catalog !== undefined) {
        // An empty catalog means "this engine has none"; send nothing rather
        // than an empty string, which QuickSight rejects.
        const catalog = edit.catalog.trim();
        if (catalog) {
          relational.Catalog = catalog;
        } else {
          delete relational.Catalog;
        }
      }
    }
  }

  private async describeOrThrow(dataSetId: string): Promise<Record<string, any>> {
    let current: Record<string, any> | undefined;
    try {
      current = await this.quickSightService.describeDataset(dataSetId);
    } catch (error) {
      logger.warn('DescribeDataSet failed', { dataSetId, error });
      throw new ValidationError(CANNOT_DESCRIBE);
    }
    if (!current?.PhysicalTableMap || !current?.ImportMode) {
      throw new ValidationError(CANNOT_DESCRIBE);
    }
    return current;
  }

  private toView(id: string, table: Record<string, any>): DatasetPhysicalTable {
    const relational = table.RelationalTable;
    const customSql = table.CustomSql;
    const s3 = table.S3Source;

    if (relational) {
      return {
        id,
        kind: 'RELATIONAL',
        dataSourceArn: relational.DataSourceArn,
        name: relational.Name,
        catalog: relational.Catalog,
        schema: relational.Schema,
        columnCount: relational.InputColumns?.length ?? 0,
        editable: true,
      };
    }

    if (customSql) {
      return {
        id,
        kind: 'CUSTOM_SQL',
        dataSourceArn: customSql.DataSourceArn,
        name: customSql.Name,
        sqlQuery: customSql.SqlQuery,
        columnCount: customSql.Columns?.length ?? 0,
        editable: true,
      };
    }

    return {
      id,
      kind: 'S3',
      dataSourceArn: s3?.DataSourceArn ?? '',
      name: id,
      columnCount: s3?.InputColumns?.length ?? 0,
      editable: false,
    };
  }
}
