/**
 * A dataset from nothing: a SQL query, a table, or a published SMUS
 * listing, read through one of the account's data sources. Same
 * preview-then-create shape as a new analysis: the preview settles every
 * fact the create will write (the data source, the table, the columns, the
 * SMUS listing it will be linked to, the folders), and the create writes
 * exactly that.
 *
 * Columns are the hard part. QuickSight refuses a custom SQL dataset whose
 * columns are not declared, and its console learns them by running the
 * query. The portal does the same through Athena for an Athena data source;
 * for any other engine, the caller declares them. A listing carries its own
 * columns in its metadata forms.
 *
 * Nothing is created in SMUS. The listing in the preview is derived from
 * what the dataset reads, by the same matching that links every other
 * dataset in the account.
 *
 * A table or a listing is read as custom SQL, `SELECT * FROM the table`,
 * unless asked for as the table itself: the query is what people open and
 * extend, and a plain select is still typed from the listing. Every
 * dataset is written in the new data prep experience (source table, import
 * and project steps, destination, semantic model): the legacy shape cannot
 * be opened in the new data prep or built on.
 */
import { randomUUID } from 'node:crypto';

import type { AthenaAdapter } from '../../../adapters/aws/AthenaAdapter';
import type { AuthContext } from '../../../shared/auth';
import { metadataBucketName } from '../../../shared/config/metadataBucket';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { ingestionIdOf } from '../../../shared/services/aws/datasetUpdate';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { catalog } from '../../../shared/services/catalog/catalogStore';
import { stripGlueCatalogIds } from '../../../shared/services/datasets/athenaSql';
import {
  type QuickSightColumnType,
  toQuickSightColumnType,
} from '../../../shared/services/datasets/columnTypes';
import { dataPrepForTable, withColumnIds } from '../../../shared/services/datasets/dataPrep';
import {
  type DataSourceUsage,
  defaultAthenaDataSource,
  isAthena,
  listDataSourceUsage,
} from '../../../shared/services/datasets/dataSourceUsage';
import {
  type SimilarDataset,
  similarDatasets,
  tablesRead,
} from '../../../shared/services/datasets/similarDatasets';
import { parseSimpleSelect } from '../../../shared/services/datasets/simpleSelect';
import { extractSqlTableRefs } from '../../../shared/services/parsing/DatasetParser';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import type { SmusService } from '../../../shared/services/smus/SmusService';
import type { TagPair } from '../../../shared/tags/tagStandards';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import type { SmusDatasetLink, SmusMatchType } from '../../../shared/types/smus';
import { logger } from '../../../shared/utils/logger';
import {
  datasetPermissionsFor,
  normalizePermissionsArray,
} from '../../../shared/utils/permissions';
import type { AuthorableAssetType } from '../types';
import { recordProvenance, tagsForCreate } from './assetWriter';
import { audienceFor, fileInFolders } from './audience';
import type { RebindService } from './RebindService';

const NAME_MAX_LENGTH = 200;
/** Athena plans a schema query in a second or two; the gateway allows thirty. */
const SCHEMA_QUERY_TIMEOUT_MS = 20_000;
/** Where Athena writes the empty result of a schema query, in the portal's own bucket. */
const ATHENA_RESULTS_PREFIX = 'athena-results/';
const ATHENA_DEFAULT_CATALOG = 'AwsDataCatalog';

export type NewDatasetSource =
  | { kind: 'sql'; dataSourceId: string; sql: string; tableName?: string }
  | {
      kind: 'table';
      dataSourceId: string;
      catalog?: string;
      schema: string;
      table: string;
      /** Read the table as a relational table rather than as `SELECT * FROM` it. */
      asTable?: boolean;
    }
  | { kind: 'listing'; listingId: string; dataSourceId?: string; asTable?: boolean };

export interface NewDatasetColumn {
  name: string;
  type: QuickSightColumnType;
}

export interface NewDatasetRequest {
  name: string;
  /** Defaults to Settings (authoring.datasetImportMode): SPICE unless an admin changed it. */
  importMode?: 'DIRECT_QUERY' | 'SPICE';
  source: NewDatasetSource;
  /** Declared when the portal cannot read them from the engine; never for a listing. */
  columns?: NewDatasetColumn[];
  /** Inherit this asset's audience: a dataset's as it is, an analysis's or dashboard's translated to dataset actions. */
  permissionsFrom?: { assetType: AuthorableAssetType | 'dataset'; assetId: string };
  folderId?: string;
  tags?: TagPair[];
  newDataSetId?: string;
}

interface PhysicalTable {
  kind: 'RELATIONAL' | 'CUSTOM_SQL';
  /** Relational: the table. Custom SQL: the query's display name. */
  name: string;
  catalog?: string;
  schema?: string;
  sql?: string;
}

export interface NewDatasetPreview {
  name: string;
  importMode: 'DIRECT_QUERY' | 'SPICE';
  dataSource: { id: string; name: string; type?: string };
  table: PhysicalTable;
  columns: NewDatasetColumn[];
  /** Where the columns came from: the request, the listing's forms, or the engine. */
  columnsFrom: 'declared' | 'listing' | 'query';
  /** The SMUS listing the dataset will be linked to, by what it reads. */
  listing?: { listingId: string; name: string; matchType: SmusMatchType; url?: string };
  /** Datasets that already read the same table, as the table or inside a query. */
  similar: SimilarDataset[];
  /** The folders it will be filed in: the request's and the defaults from Settings. */
  folderIds: string[];
  warnings: string[];
}

export interface NewDatasetResult extends NewDatasetPreview {
  assetType: 'dataset';
  assetId: string;
  arn: string;
  /** The QuickSight user made its owner: the person who built it. */
  owner?: string;
  /** SPICE: the first import, which QuickSight starts on creation; data shows once it completes. */
  ingestionId?: string;
}

/** The import mode a request that names none gets: Settings, SPICE unless changed. */
function defaultImportMode(): 'DIRECT_QUERY' | 'SPICE' {
  return settingsStore.get('authoring.datasetImportMode') === 'DIRECT_QUERY'
    ? 'DIRECT_QUERY'
    : 'SPICE';
}

interface Composed {
  preview: NewDatasetPreview;
  dataSource: DataSourceUsage;
  audience: Awaited<ReturnType<typeof audienceFor>>;
}

export class NewDatasetService {
  private readonly quickSightService: QuickSightService;

  public constructor(
    private readonly accountId: string,
    private readonly rebindService: Pick<RebindService, 'permissionsOf'>,
    private readonly smus: Pick<SmusService, 'listing' | 'listingFor' | 'getLinkMap'>,
    private readonly athena: Pick<AthenaAdapter, 'querySchema'>,
    private readonly smusConfigured: boolean
  ) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  /** Every data source a new dataset can read through, by use. */
  public async dataSources(): Promise<DataSourceUsage[]> {
    const links = this.smusConfigured
      ? await this.smus.getLinkMap()
      : new Map<string, SmusDatasetLink>();
    return listDataSourceUsage(links);
  }

  public async preview(request: NewDatasetRequest, auth?: AuthContext): Promise<NewDatasetPreview> {
    return (await this.compose(request, auth)).preview;
  }

  public async create(request: NewDatasetRequest, auth?: AuthContext): Promise<NewDatasetResult> {
    const { preview, dataSource, audience } = await this.compose(request, auth);
    const dataSetId = request.newDataSetId?.trim() || randomUUID();
    const physicalTableId = randomUUID();
    const tags = tagsForCreate(dataSetId, request.tags, auth);
    logger.info('Creating dataset from nothing', {
      dataSetId,
      source: request.source.kind,
      dataSource: dataSource.id,
      columns: preview.columns.length,
      importMode: preview.importMode,
      permissions: audience.permissions?.length ?? 0,
    });

    // The physical table declares what the source has; the pipeline is what
    // an analysis reads: the table imported and every column projected, as
    // QuickSight's console writes it. A dataset without that leaves an
    // analysis built on it blank, with no field to bind.
    const created = await this.quickSightService.createDataSet({
      dataSetId,
      name: preview.name,
      importMode: preview.importMode,
      permissions: audience.permissions?.length ? audience.permissions : undefined,
      ...(tags.length > 0 ? { tags } : {}),
      physicalTableMap: withColumnIds({
        [physicalTableId]: physicalTableFor(preview, dataSource.arn),
      }) as any,
      ...dataPrepForTable({
        physicalTableId,
        alias: preview.table.name,
        columns: preview.columns.map((c) => c.name),
      }),
    });

    const { filed, warnings: filing } = await fileInFolders(
      this.quickSightService,
      audience.folderIds,
      created.dataSetId,
      'dataset'
    );
    preview.warnings.push(...filing);
    await recordProvenance(
      this.quickSightService,
      {
        action: 'authoring.create',
        assetType: 'dataset',
        assetId: created.dataSetId,
        arn: created.arn,
        name: preview.name,
        folderIds: filed,
        details: {
          source: request.source.kind,
          dataSourceId: dataSource.id,
          columns: preview.columns.length,
          ...(preview.listing ? { listingId: preview.listing.listingId } : {}),
        },
      },
      auth
    );
    const ingestionId = ingestionIdOf(created.ingestionArn);
    return {
      assetType: 'dataset',
      assetId: created.dataSetId,
      arn: created.arn,
      ...preview,
      folderIds: filed,
      ...(audience.owner ? { owner: audience.owner.userName } : {}),
      ...(ingestionId ? { ingestionId } : {}),
    };
  }

  /** Everything the create will write, checked; throws on what cannot be settled. */
  private async compose(request: NewDatasetRequest, auth?: AuthContext): Promise<Composed> {
    const name = request.name.trim();
    if (!name) {
      throw new ValidationError('A name is required');
    }
    if (name.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Name must be at most ${NAME_MAX_LENGTH} characters`);
    }
    const importMode = request.importMode ?? defaultImportMode();
    const usage = await this.dataSources();
    const warnings: string[] = [];

    const settled = await this.settleSource(request, usage, name);
    const { dataSource, table } = settled;
    if (table.kind === 'CUSTOM_SQL' && table.sql && isAthena(dataSource)) {
      const corrected = stripGlueCatalogIds(table.sql);
      if (corrected.stripped) {
        table.sql = corrected.sql;
        warnings.push(
          'The query named a table through its Glue catalog id (the account number), which Athena does not know; it was removed, and the table is read from the default catalog.'
        );
      }
    }
    const fromListing =
      !settled.columns && table.kind === 'CUSTOM_SQL'
        ? await this.columnsFromListing(table.sql as string)
        : undefined;
    const columns =
      settled.columns ?? fromListing ?? (await this.columnsFromEngine(dataSource, table));
    const columnsFrom = settled.columns ? settled.columnsFrom : fromListing ? 'listing' : 'query';
    if (columns.length === 0) {
      throw new ValidationError('The query returns no columns');
    }

    const link = await this.smus.listingFor({
      name,
      physicalTables: [
        table.kind === 'RELATIONAL'
          ? { type: 'RELATIONAL', schema: table.schema, name: table.name }
          : { type: 'CUSTOM_SQL', name: table.name, sqlTables: extractSqlTableRefs(table.sql) },
      ],
    });
    const similar = similarDatasets(await catalog.list(ASSET_TYPES.dataset), tablesRead(table));
    if (similar.length > 0) {
      warnings.push(
        `${similar.length === 1 ? 'A dataset already reads' : `${similar.length} datasets already read`} ${[...new Set(similar.map((d) => d.table))].join(', ')}: ${similar.map((d) => `${d.name} (${d.dataSetId}${d.how === 'sql' ? ', in its query' : ''})`).join('; ')}.`
      );
    }
    const inherited = await this.inheritedPermissions(request.permissionsFrom);
    const audience = await audienceFor('dataset', inherited, auth, request.folderId);
    warnings.push(...audience.warnings);

    return {
      dataSource,
      audience,
      preview: {
        name,
        importMode,
        dataSource: {
          id: dataSource.id,
          name: dataSource.name,
          ...(dataSource.type ? { type: dataSource.type } : {}),
        },
        table,
        columns,
        columnsFrom,
        ...(link.linked && link.listingId
          ? {
              listing: {
                listingId: link.listingId,
                name: link.listingName ?? link.listingId,
                matchType: link.matchType ?? 'name',
                ...(link.url ? { url: link.url } : {}),
              },
            }
          : {}),
        similar,
        folderIds: audience.folderIds,
        warnings,
      },
    };
  }

  /** The data source and physical table the request names, and the columns when it carries them. */
  private async settleSource(
    request: NewDatasetRequest,
    usage: DataSourceUsage[],
    name: string
  ): Promise<{
    dataSource: DataSourceUsage;
    table: PhysicalTable;
    columns?: NewDatasetColumn[];
    columnsFrom: 'declared' | 'listing';
  }> {
    const { source } = request;
    const declared = request.columns?.length ? request.columns : undefined;
    if (source.kind === 'listing') {
      if (declared) {
        throw new ValidationError(
          "A listing's columns come from its metadata forms; do not declare them"
        );
      }
      const listing = await this.smus.listing(source.listingId);
      if (!listing) {
        throw new ValidationError(
          this.smusConfigured
            ? `No published asset with listing id '${source.listingId}'`
            : 'SMUS is not configured, so there are no listings to build on'
        );
      }
      if (!listing.table) {
        throw new ValidationError(
          `'${listing.name}' has no table identity in its metadata forms, so a dataset cannot be built from it`
        );
      }
      if (!listing.columns || listing.columns.length === 0) {
        throw new ValidationError(`'${listing.name}' lists no columns in its metadata forms`);
      }
      const dataSource = source.dataSourceId
        ? this.dataSourceById(usage, source.dataSourceId)
        : defaultAthenaDataSource(usage)?.dataSource;
      if (!dataSource) {
        throw new ValidationError(
          'No Athena data source exists in this account to read the SMUS table through; create one in QuickSight or pass dataSourceId'
        );
      }
      return {
        dataSource,
        table: tableOrSelect(
          {
            catalog: athenaCatalogName(listing.table.catalog),
            schema: listing.table.database,
            name: listing.table.name,
          },
          source.asTable === true,
          name
        ),
        columns: listing.columns.map((c) => ({
          name: c.name,
          type: toQuickSightColumnType(c.type),
        })),
        columnsFrom: 'listing',
      };
    }
    const dataSource = this.dataSourceById(usage, source.dataSourceId);
    if (!dataSource) {
      throw new ValidationError(
        "The selected data source is not one of this account's data sources (GET /api/authoring/datasources lists them)"
      );
    }
    if (source.kind === 'sql') {
      const sql = source.sql.trim();
      if (!sql) {
        throw new ValidationError('sql cannot be empty');
      }
      return {
        dataSource,
        table: { kind: 'CUSTOM_SQL', name: source.tableName?.trim() || name, sql },
        columns: declared,
        columnsFrom: 'declared',
      };
    }
    const schema = source.schema.trim();
    const table = source.table.trim();
    if (!schema || !table) {
      throw new ValidationError('A table needs its schema (database) and table name');
    }
    const catalogName =
      (isAthena(dataSource) ? athenaCatalogName(source.catalog) : source.catalog?.trim()) || '';
    return {
      dataSource,
      table: tableOrSelect(
        { name: table, schema, ...(catalogName ? { catalog: catalogName } : {}) },
        source.asTable === true,
        name
      ),
      columns: declared,
      columnsFrom: 'declared',
    };
  }

  private dataSourceById(usage: DataSourceUsage[], id: string): DataSourceUsage | undefined {
    return usage.find((d) => d.id === id);
  }

  /**
   * A query that only selects columns of one published table has its
   * columns in the listing's forms already: no engine read, and so no Lake
   * Formation grant, is needed. Anything the listing cannot type (a column
   * it does not have, a function, a join) is left to the engine.
   */
  private async columnsFromListing(sql: string): Promise<NewDatasetColumn[] | undefined> {
    const select = parseSimpleSelect(sql);
    if (!select || !this.smusConfigured) {
      return undefined;
    }
    const link = await this.smus.listingFor({
      name: '',
      physicalTables: [
        { type: 'CUSTOM_SQL', name: '', sqlTables: [select.table.split('.').slice(-2).join('.')] },
      ],
    });
    const listing =
      link.linked && link.listingId ? await this.smus.listing(link.listingId) : undefined;
    const known = listing?.columns ?? [];
    if (known.length === 0) {
      return undefined;
    }
    if (select.columns === '*') {
      return known.map((c) => ({ name: c.name, type: toQuickSightColumnType(c.type) }));
    }
    const byName = new Map(known.map((c) => [c.name.toLowerCase(), c]));
    const columns: NewDatasetColumn[] = [];
    for (const column of select.columns) {
      const match = byName.get(column.source.toLowerCase());
      if (!match) {
        return undefined;
      }
      columns.push({ name: column.name, type: toQuickSightColumnType(match.type) });
    }
    return columns;
  }

  /**
   * The columns the engine says the table or query has. Only Athena can be
   * asked from here; any other engine needs them declared.
   */
  private async columnsFromEngine(
    dataSource: DataSourceUsage,
    table: PhysicalTable
  ): Promise<NewDatasetColumn[]> {
    if (!isAthena(dataSource)) {
      throw new ValidationError(
        `The portal reads a query's columns by running it through Athena, and '${dataSource.name}' is ${dataSource.type ? `a ${dataSource.type}` : 'not an Athena'} data source: declare columns ([{ name, type }], types STRING, INTEGER, DECIMAL, DATETIME, BOOLEAN, BIT or JSON)`
      );
    }
    const sql =
      table.kind === 'CUSTOM_SQL'
        ? (table.sql as string)
        : `SELECT * FROM ${quoteIdentifier(table.schema as string)}.${quoteIdentifier(table.name)}`;
    const workGroup = dataSource.workGroup || 'primary';
    try {
      const columns = await this.athena.querySchema({
        sql,
        workGroup,
        catalog: table.catalog,
        outputLocation: `s3://${metadataBucketName(this.accountId)}/${ATHENA_RESULTS_PREFIX}`,
        timeoutMs: SCHEMA_QUERY_TIMEOUT_MS,
      });
      return columns.map((c) => ({ name: c.name, type: toQuickSightColumnType(c.type) }));
    } catch (error: any) {
      const reason: string = error?.message ?? 'unknown error';
      throw new ValidationError(
        `Athena (workgroup ${workGroup}) could not run the query to read its columns: ${reason}.${hiddenTableHint(reason, sql)} Fix the query, or declare the columns.`
      );
    }
  }

  /** The audience to copy: a dataset's as it is, an asset's translated to dataset actions. */
  private async inheritedPermissions(
    from: NewDatasetRequest['permissionsFrom']
  ): Promise<any[] | undefined> {
    if (!from) {
      return undefined;
    }
    if (from.assetType === 'dataset') {
      return normalizePermissionsArray(
        await this.quickSightService.describeDatasetPermissions(from.assetId)
      );
    }
    return datasetPermissionsFor(
      await this.rebindService.permissionsOf(from.assetType, from.assetId)
    );
  }
}

/** Athena's wording when Lake Formation hides a table the role is not granted on. */
const TABLE_HIDDEN = /TABLE_NOT_FOUND|SCHEMA_NOT_FOUND|does not exist|EntityNotFound/i;

/**
 * Lake Formation hides a table from a principal with no grant on it, and
 * Athena then says the table does not exist. Every table SMUS publishes is
 * governed this way, so a "not found" over a real table usually means the
 * portal's role was never granted: say so, with the databases to grant.
 */
function hiddenTableHint(reason: string, sql: string): string {
  if (!TABLE_HIDDEN.test(reason)) {
    return '';
  }
  const databases = [
    ...new Set(
      extractSqlTableRefs(sql)
        .map((ref) => ref.split('.').slice(-2, -1)[0])
        .filter((db): db is string => Boolean(db))
    ),
  ];
  const which = databases.length > 0 ? databases.join(',') : '<database>';
  return ` If the table exists, Lake Formation is hiding it: the portal's role has no grant on it. Settings > Athena access shows which databases the role can see; a data lake admin runs \`just athena-grant ${which}\` once (SELECT and DESCRIBE for the role on those databases).`;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** The PhysicalTableMap entry the preview describes. */
/** A Glue catalog id is the account number; Athena knows that catalog as AwsDataCatalog. */
const GLUE_CATALOG_ID = /^\d{12}$/;

/** The catalog as Athena names it: the default for none or for a Glue catalog id. */
function athenaCatalogName(catalogName: string | undefined): string {
  const name = catalogName?.trim();
  return !name || GLUE_CATALOG_ID.test(name) ? ATHENA_DEFAULT_CATALOG : name;
}

/**
 * `"schema"."table"`, with a catalog first only when Athena knows it by
 * that name: not its default, and not the Glue catalog id a listing carries.
 */
function quotedTableRef(table: { catalog?: string; schema?: string; name: string }): string {
  const quote = (part: string) => `"${part.replace(/"/g, '""')}"`;
  const named =
    table.catalog &&
    table.catalog !== ATHENA_DEFAULT_CATALOG &&
    !GLUE_CATALOG_ID.test(table.catalog);
  const parts = [
    ...(named ? [table.catalog as string] : []),
    ...(table.schema ? [table.schema] : []),
    table.name,
  ];
  return parts.map(quote).join('.');
}

/** The table as a relational table, or as the custom SQL `SELECT * FROM` it (the default). */
function tableOrSelect(
  table: { catalog?: string; schema: string; name: string },
  asTable: boolean,
  datasetName: string
): PhysicalTable {
  if (asTable) {
    return { kind: 'RELATIONAL', ...table };
  }
  return { kind: 'CUSTOM_SQL', name: datasetName, sql: `SELECT * FROM ${quotedTableRef(table)}` };
}

function physicalTableFor(preview: NewDatasetPreview, dataSourceArn: string): Record<string, any> {
  const columns = preview.columns.map((c) => ({ Name: c.name, Type: c.type }));
  if (preview.table.kind === 'CUSTOM_SQL') {
    return {
      CustomSql: {
        DataSourceArn: dataSourceArn,
        Name: preview.table.name,
        SqlQuery: preview.table.sql,
        Columns: columns,
      },
    };
  }
  return {
    RelationalTable: {
      DataSourceArn: dataSourceArn,
      ...(preview.table.catalog ? { Catalog: preview.table.catalog } : {}),
      Schema: preview.table.schema,
      Name: preview.table.name,
      InputColumns: columns,
    },
  };
}
