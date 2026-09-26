import type { components, paths } from '@shared/generated/types';

import { accepted, client, unwrap } from '../typed';

type Schemas = components['schemas'];

type DatasetSource = Schemas['DatasetSource'];
export type DatasetPhysicalTable = Schemas['DatasetPhysicalTable'];
export type DatasetTableEdit = Schemas['DatasetTableEdit'];
export type DataSourceOption = Schemas['DataSourceOption'];
/** The GET response adds the selectable data sources to the dataset's own sources. */
type DatasetSourceResponse = DatasetSource & { dataSources: DataSourceOption[] };

type PaginatedQuery = NonNullable<
  paths['/api/assets/{assetType}/paginated']['get']['parameters']['query']
>;
type PluralAssetType =
  paths['/api/assets/{assetType}/paginated']['get']['parameters']['path']['assetType'];

/** Params shared by every paginated list endpoint; `filters` is sent JSON-encoded. */
export type PaginatedListParams = Omit<PaginatedQuery, 'filters'> & {
  filters?: Record<string, unknown>;
};

type FilterCount = Schemas['FilterValueCount'];

/** Response shape of a paginated list keyed by its collection name */
type PaginatedList<K extends string, TItem> = { [P in K]: TItem[] } & {
  pagination: Schemas['PaginationInfo'];
  fromCache?: boolean;
};

type CsvExportQuery = NonNullable<
  paths['/api/assets/{assetType}/export']['get']['parameters']['query']
>;
export type ArchivedQuery = NonNullable<
  paths['/api/assets/archived']['get']['parameters']['query']
>;
export type RenamableAssetType =
  paths['/api/assets/{assetType}/{assetId}/rename']['post']['parameters']['path']['assetType'];
type PermissionAssetType =
  paths['/api/assets/{assetType}/{assetId}/permission-sources']['get']['parameters']['path']['assetType'];
type CachedAssetType =
  paths['/api/assets/{assetType}/{assetId}/cached']['get']['parameters']['path']['assetType'];
type TaggableAssetType =
  paths['/api/tags/{assetType}/{assetId}']['put']['parameters']['path']['assetType'];
type AssetType = Schemas['AssetType'];
type Tag = Schemas['Tag'];

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: string): value is T =>
    (values as readonly string[]).includes(value);

/** Whether an asset type has permissions the portal can read and revoke (users and groups do not). */
export const hasPermissions = oneOf<PermissionAssetType>([
  'dashboard',
  'analysis',
  'dataset',
  'datasource',
  'folder',
]);

/** Whether QuickSight lets the portal rename this asset type. */
export const isRenamable = oneOf<RenamableAssetType>([
  'dashboard',
  'analysis',
  'dataset',
  'folder',
]);

const PLURAL: Record<AssetType, PluralAssetType> = {
  dashboard: 'dashboards',
  analysis: 'analyses',
  dataset: 'datasets',
  datasource: 'datasources',
  folder: 'folders',
  user: 'users',
  group: 'groups',
};

/**
 * One fetcher for all seven paginated asset lists - identical wire contract,
 * differing only in the path segment, collection key, and item type. The
 * contract keys the page by the type asked for, so each list names its own.
 */
async function getPaginatedList<TResult>(
  assetType: PluralAssetType,
  params: PaginatedListParams = {}
): Promise<TResult> {
  const { filters, ...query } = params;
  const data = unwrap(
    await client.GET('/api/assets/{assetType}/paginated', {
      params: {
        path: { assetType },
        query: { ...query, filters: filters ? JSON.stringify(filters) : undefined },
      },
    }),
    `Failed to fetch ${assetType}`
  );
  return data as TResult;
}

/**
 * Assets API - handles all QuickSight asset types (dashboards, analyses, datasets, datasources)
 */
export const assetsApi = {
  /** Rename an asset live in QuickSight. */
  async renameAsset(assetType: RenamableAssetType, assetId: string, name: string) {
    return unwrap(
      await client.POST('/api/assets/{assetType}/{assetId}/rename', {
        params: { path: { assetType, assetId } },
        body: { name },
      }),
      'Failed to rename asset'
    );
  },

  /** Where a dataset reads its data from, live, plus the data sources a table may point at. */
  async getDatasetSource(assetId: string): Promise<DatasetSourceResponse> {
    return unwrap(
      await client.GET('/api/assets/dataset/{assetId}/source', { params: { path: { assetId } } }),
      'Failed to read the dataset source'
    );
  },

  /** Repoint a dataset's physical tables and/or rename it. */
  async updateDatasetSource(
    assetId: string,
    update: { name?: string; tables?: DatasetTableEdit[] }
  ): Promise<DatasetSource> {
    return unwrap(
      await client.PUT('/api/assets/dataset/{assetId}/source', {
        params: { path: { assetId } },
        body: update,
      }),
      'Failed to update the dataset source'
    );
  },

  /** Replace an asset's tags. */
  async updateAssetTags(assetType: TaggableAssetType, assetId: string, tags: Tag[]): Promise<void> {
    unwrap(
      await client.PUT('/api/tags/{assetType}/{assetId}', {
        params: { path: { assetType, assetId } },
        body: { tags },
      }),
      'Failed to update tags'
    );
  },

  /** Add, replace or remove tags on many assets: queues a job and returns it. */
  async bulkUpdateAssetTags(
    assetType: string,
    assetIds: string[],
    operation: 'add' | 'remove' | 'update',
    tags?: Tag[],
    tagKeys?: string[]
  ) {
    return accepted(
      await client.POST('/api/tags/bulk', {
        body: { assetType: assetType.toLowerCase(), assetIds, operation, tags, tagKeys },
      }),
      'Failed to bulk update tags'
    );
  },

  getDatasetsPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'datasets', Schemas['DatasetListItem']> & {
        availableSourceTypes?: FilterCount[];
      }
    >('datasets', params);
  },

  getDashboardsPaginated(params?: PaginatedListParams) {
    return getPaginatedList<PaginatedList<'dashboards', Schemas['DashboardListItem']>>(
      'dashboards',
      params
    );
  },

  getAnalysesPaginated(params?: PaginatedListParams) {
    return getPaginatedList<PaginatedList<'analyses', Schemas['AnalysisListItem']>>(
      'analyses',
      params
    );
  },

  getDatasourcesPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'datasources', Schemas['DatasourceListItem']> & {
        availableSourceTypes?: FilterCount[];
      }
    >('datasources', params);
  },

  getFoldersPaginated(params?: PaginatedListParams) {
    return getPaginatedList<PaginatedList<'folders', Schemas['FolderListItem']>>('folders', params);
  },

  getGroupsPaginated(params?: PaginatedListParams) {
    return getPaginatedList<PaginatedList<'groups', Schemas['GroupListItem']>>('groups', params);
  },

  getUsersPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'users', Schemas['UserListItem']> & {
        availableRoles?: FilterCount[];
        availableGroups?: FilterCount[];
      }
    >('users', params);
  },

  /** How each user has access to an asset: direct, by group, or by shared folder. */
  async getPermissionSources(assetType: PermissionAssetType, assetId: string) {
    return unwrap(
      await client.GET('/api/assets/{assetType}/{assetId}/permission-sources', {
        params: { path: { assetType, assetId } },
      }),
      'Failed to fetch permission sources'
    );
  },

  /** Revoke direct permissions from an asset: queues a job and returns it. */
  async bulkRevokePermissions(
    assetType: PermissionAssetType,
    assetId: string,
    revocations: Array<{ principal: string; actions: string[] }>
  ) {
    return accepted(
      await client.POST('/api/assets/{assetType}/{assetId}/revoke-permissions', {
        params: { path: { assetType, assetId } },
        body: { revocations },
      }),
      'Failed to revoke permissions'
    );
  },

  /** Every asset a user can open, and how. */
  async getUserAssetAccess(userName: string, assetType?: AssetType) {
    return unwrap(
      await client.GET('/api/users/{userName}/asset-access', {
        params: { path: { userName }, query: { assetType } },
      }),
      'Failed to fetch user asset access'
    );
  },

  /** The asset as the last export saved it (for the JSON viewer and wireframes). */
  async getCachedAsset(assetType: CachedAssetType, assetId: string): Promise<any> {
    return unwrap(
      await client.GET('/api/assets/{assetType}/{assetId}/cached', {
        params: { path: { assetType, assetId } },
      }),
      'Failed to fetch cached asset'
    );
  },

  /** Re-read tags from QuickSight for these assets. */
  async refreshAssetTags(assetType: string, assetIds: string[]) {
    return unwrap(
      await client.POST('/api/tags/refresh', { body: { assetType, assetIds } }),
      'Failed to refresh tags'
    );
  },

  /** Export every asset of a type to CSV: queues a job; the CSV is its result. */
  async exportAssets(
    assetType: AssetType,
    params: Omit<CsvExportQuery, 'filters'> & { filters?: Record<string, unknown> } = {}
  ) {
    const { filters, ...query } = params;
    return accepted(
      await client.GET('/api/assets/{assetType}/export', {
        params: {
          path: { assetType: PLURAL[assetType] },
          query: { ...query, filters: filters ? JSON.stringify(filters) : undefined },
        },
      }),
      'Failed to export assets'
    );
  },

  async getArchivedAssetsPaginated(params: ArchivedQuery = {}) {
    return unwrap(
      await client.GET('/api/assets/archived', { params: { query: params } }),
      'Failed to fetch archived assets'
    );
  },

  /** Delete assets and archive their exports: queues a job and returns it. */
  async bulkDelete(assets: Array<{ type: AssetType; id: string }>, reason: string) {
    return accepted(
      await client.POST('/api/assets/bulk-delete', { body: { assets, reason } }),
      'Failed to delete assets'
    );
  },

  /** What stands between an archived dataset or data source and its restore. */
  async previewSourceRestore(
    assetType: 'dataset' | 'datasource',
    assetId: string,
    newAssetId?: string
  ) {
    return unwrap(
      await client.POST('/api/assets/{assetType}/{assetId}/restore/preview', {
        params: { path: { assetType, assetId } },
        body: newAssetId ? { newAssetId } : {},
      }),
      'Failed to check the restore'
    );
  },

  /** Restore an archived dataset or data source (refused while a check blocks it). */
  async restoreSource(
    assetType: 'dataset' | 'datasource',
    assetId: string,
    request: { newAssetId?: string; name?: string } = {}
  ) {
    return unwrap(
      await client.POST('/api/assets/{assetType}/{assetId}/restore', {
        params: { path: { assetType, assetId } },
        body: request,
      }),
      'Failed to restore it'
    );
  },

  /** An archived asset's export, for the Studio to open it. */
  async getArchivedAssetMetadata(assetType: AssetType, assetId: string) {
    return unwrap(
      await client.GET('/api/assets/archive/{assetType}/{assetId}/metadata', {
        params: { path: { assetType, assetId } },
      }),
      'Failed to fetch archived asset metadata'
    );
  },
};
