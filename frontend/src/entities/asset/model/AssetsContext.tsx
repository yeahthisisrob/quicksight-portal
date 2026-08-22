/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

import { assetsApi } from '@/shared/api';

import type { AssetListItem, components } from '@shared/generated';

// Cross-tab caching for asset lists: within the stale window a tab switch is
// served instantly from the query cache; explicit refreshes invalidate first,
// which forces a refetch regardless of staleness.
const LIST_STALE_TIME_MS = 2 * 60 * 1000;
const LIST_GC_TIME_MS = 30 * 60 * 1000;

/**
 * Apply a tag update to the matching item, immutably. Shared by the
 * optimistic local-state update and the query-cache write-through so the two
 * can never disagree.
 */
export function applyTagsToItems(
  items: AssetData[] | undefined,
  assetId: string,
  tags: any[]
): AssetData[] | undefined {
  if (!items) {
    return items;
  }
  return items.map((item) => (item.id === assetId ? { ...item, tags } : item));
}

/**
 * Remove deleted assets from a list, immutably. Shared by the optimistic
 * local-state update and the query-cache write-through after deletes.
 */
export function removeAssetsFromItems(
  items: AssetData[] | undefined,
  assetIds: Set<string>
): AssetData[] | undefined {
  if (!items) {
    return items;
  }
  return items.filter((item) => !assetIds.has(item.id));
}

// The backend serves list reads from a per-container memory copy for up to
// this long before re-checking S3 (CACHE_CONFIG.REVALIDATE_WINDOW_MS = 3s).
// A refetch fired immediately after a mutation can land inside that window
// and read the pre-mutation list; a follow-up refresh just past it converges.
const BACKEND_REVALIDATE_WINDOW_MS = 3500;

// Grounded in the generated OpenAPI schema; the index signature admits the
// per-type enrichment fields (email, memberCount, …) the backend adds
type AssetData = AssetListItem & { [key: string]: any };

type PaginationInfo = components['schemas']['PaginationInfo'];

export type FetchParams = {
  page: number;
  pageSize: number;
  search?: string;
  dateRange?: string;
  sortBy?: string;
  sortOrder?: string;
  filters?: Record<string, any>;
  dateField?: string;
  includeTags?: string;
  excludeTags?: string;
  errorFilter?: string;
  activityFilter?: string;
  roleFilter?: string;
  groupMembershipFilter?: string;
  groupFilter?: string;
  permissionsFilter?: string;
  sourceTypeFilter?: string;
  includeFolders?: string;
  excludeFolders?: string;
  smusFilter?: string;
  importModeFilter?: string;
};

export type AssetFetchFn = (options: FetchParams) => Promise<void>;

interface AssetsContextType {
  // Cached data
  exportSummary: any;
  exportSummaryLoading: boolean;

  // Asset data by type
  dashboards: AssetData[];
  dashboardsLoading: boolean;
  dashboardsPagination: PaginationInfo | null;

  datasets: AssetData[];
  datasetsLoading: boolean;
  datasetsPagination: PaginationInfo | null;

  analyses: AssetData[];
  analysesLoading: boolean;
  analysesPagination: PaginationInfo | null;

  datasources: AssetData[];
  datasourcesLoading: boolean;
  datasourcesPagination: PaginationInfo | null;

  folders: AssetData[];
  foldersLoading: boolean;
  foldersPagination: PaginationInfo | null;

  users: AssetData[];
  usersLoading: boolean;
  usersPagination: PaginationInfo | null;

  groups: AssetData[];
  groupsLoading: boolean;
  groupsPagination: PaginationInfo | null;

  // Available filter options (from cache)
  availableRoles: Array<{ value: string; count: number }>;
  availableGroups: Array<{ value: string; count: number }>;
  availableSourceTypes: Array<{ value: string; count: number }>;

  // Refresh trigger - incremented when data should be re-fetched
  refreshKey: number;

  // Methods
  fetchDashboards: AssetFetchFn;
  fetchDatasets: AssetFetchFn;
  fetchAnalyses: AssetFetchFn;
  fetchDatasources: AssetFetchFn;
  fetchFolders: AssetFetchFn;
  fetchUsers: AssetFetchFn;
  fetchGroups: AssetFetchFn;
  refreshExportSummary: () => Promise<void>;
  refreshAssetType: (assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group') => Promise<void>;

  // Tag updates
  updateAssetTags: (assetType: string, assetId: string, tags: any[]) => void;
  removeAssets: (assetType: string, assetIds: string[]) => void;
}

const AssetsContext = createContext<AssetsContextType | undefined>(undefined);

export const useAssets = () => {
  const context = useContext(AssetsContext);
  if (!context) {
    throw new Error('useAssets must be used within an AssetsProvider');
  }
  return context;
};

/**
 * Non-throwing variant for components that can render outside the provider
 * (e.g. in Storybook) but want to participate in optimistic updates when
 * the provider is present.
 */
export const useAssetsOptional = () => useContext(AssetsContext);

interface AssetsProviderProps {
  children: ReactNode;
}

// Asset type configuration for the factory
interface AssetTypeConfig {
  key: string;                           // Request key prefix
  apiMethod: (params: FetchParams) => Promise<any>;
  dataKey: string;                       // Key in response to get items
  queryKey: string;                      // Query invalidation key
}

const ASSET_CONFIGS: Record<string, AssetTypeConfig> = {
  dashboards: {
    key: 'dashboards',
    apiMethod: assetsApi.getDashboardsPaginated,
    dataKey: 'dashboards',
    queryKey: 'dashboards-paginated',
  },
  datasets: {
    key: 'datasets',
    apiMethod: assetsApi.getDatasetsPaginated,
    dataKey: 'datasets',
    queryKey: 'datasets-paginated',
  },
  analyses: {
    key: 'analyses',
    apiMethod: assetsApi.getAnalysesPaginated,
    dataKey: 'analyses',
    queryKey: 'analyses-paginated',
  },
  datasources: {
    key: 'datasources',
    apiMethod: assetsApi.getDatasourcesPaginated,
    dataKey: 'datasources',
    queryKey: 'datasources-paginated',
  },
  folders: {
    key: 'folders',
    apiMethod: assetsApi.getFoldersPaginated,
    dataKey: 'folders',
    queryKey: 'folders-list',
  },
  users: {
    key: 'users',
    apiMethod: assetsApi.getUsersPaginated,
    dataKey: 'users',
    queryKey: 'users-list',
  },
  groups: {
    key: 'groups',
    apiMethod: assetsApi.getGroupsPaginated,
    dataKey: 'groups',
    queryKey: 'groups',
  },
};

// Map from singular to plural for refreshAssetType
const ASSET_TYPE_MAP: Record<string, string> = {
  dashboard: 'dashboards',
  dataset: 'datasets',
  analysis: 'analyses',
  datasource: 'datasources',
  folder: 'folders',
  user: 'users',
  group: 'groups',
};

export const AssetsProvider: React.FC<AssetsProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();

  // State for each asset type - using a record pattern for DRY
  const [dashboards, setDashboards] = useState<AssetData[]>([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [dashboardsPagination, setDashboardsPagination] = useState<PaginationInfo | null>(null);

  const [datasets, setDatasets] = useState<AssetData[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsPagination, setDatasetsPagination] = useState<PaginationInfo | null>(null);

  const [analyses, setAnalyses] = useState<AssetData[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [analysesPagination, setAnalysesPagination] = useState<PaginationInfo | null>(null);

  const [datasources, setDatasources] = useState<AssetData[]>([]);
  const [datasourcesLoading, setDatasourcesLoading] = useState(false);
  const [datasourcesPagination, setDatasourcesPagination] = useState<PaginationInfo | null>(null);

  const [folders, setFolders] = useState<AssetData[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersPagination, setFoldersPagination] = useState<PaginationInfo | null>(null);

  const [users, setUsers] = useState<AssetData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPagination, setUsersPagination] = useState<PaginationInfo | null>(null);

  const [groups, setGroups] = useState<AssetData[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsPagination, setGroupsPagination] = useState<PaginationInfo | null>(null);

  const [availableRoles, setAvailableRoles] = useState<Array<{ value: string; count: number }>>([]);
  const [availableGroups, setAvailableGroups] = useState<Array<{ value: string; count: number }>>([]);
  const [availableSourceTypes, setAvailableSourceTypes] = useState<Array<{ value: string; count: number }>>([]);

  // Refresh trigger - incremented to signal tables to re-fetch with current params
  const [refreshKey, setRefreshKey] = useState(0);

  // Export summary query with proper caching (react-query dedupes in-flight
  // requests itself — no extra wrapper needed)
  const { data: exportSummary, isLoading: exportSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['export-summary'],
    queryFn: () => assetsApi.getExportSummary(),
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // State setters map for the factory
  const stateSetters = useMemo(() => ({
    dashboards: { setData: setDashboards, setLoading: setDashboardsLoading, setPagination: setDashboardsPagination },
    datasets: { setData: setDatasets, setLoading: setDatasetsLoading, setPagination: setDatasetsPagination },
    analyses: { setData: setAnalyses, setLoading: setAnalysesLoading, setPagination: setAnalysesPagination },
    datasources: { setData: setDatasources, setLoading: setDatasourcesLoading, setPagination: setDatasourcesPagination },
    folders: { setData: setFolders, setLoading: setFoldersLoading, setPagination: setFoldersPagination },
    users: { setData: setUsers, setLoading: setUsersLoading, setPagination: setUsersPagination },
    groups: { setData: setGroups, setLoading: setGroupsLoading, setPagination: setGroupsPagination },
  }), []);

  // Factory function to create fetch methods - eliminates 7 duplicate implementations
  const createAssetFetcher = useCallback((assetType: keyof typeof ASSET_CONFIGS): AssetFetchFn => {
    const config = ASSET_CONFIGS[assetType];
    const setters = stateSetters[assetType];

    return async (options: FetchParams) => {
      const { page, pageSize } = options;
      setters.setLoading(true);

      try {
        // The full options object is the query key (react-query hashes it
        // structurally), so every filter — including the DataGrid filter
        // model — participates in caching and in-flight dedupe. Cached pages
        // serve tab switches instantly; invalidation forces refetches.
        const data = await queryClient.fetchQuery({
          queryKey: [config.queryKey, options],
          queryFn: () => config.apiMethod(options),
          staleTime: LIST_STALE_TIME_MS,
          gcTime: LIST_GC_TIME_MS,
        });

        const items = data[config.dataKey] || [];
        setters.setData(items);

        // Capture available filter options from responses
        if (assetType === 'users') {
          if (data.availableRoles) setAvailableRoles(data.availableRoles);
          if (data.availableGroups) setAvailableGroups(data.availableGroups);
        }
        if (assetType === 'datasets' || assetType === 'datasources') {
          if (data.availableSourceTypes) setAvailableSourceTypes(data.availableSourceTypes);
        }

        // Handle pagination with fallback for backwards compatibility
        setters.setPagination(data.pagination || {
          page,
          pageSize,
          totalItems: items.length,
          totalPages: Math.ceil(items.length / pageSize),
          hasMore: false,
        });
      } catch (_error) {
        setters.setData([]);
      } finally {
        setters.setLoading(false);
      }
    };
  }, [queryClient, stateSetters]);

  // Create all fetch methods using the factory
  const fetchDashboards = useMemo(() => createAssetFetcher('dashboards'), [createAssetFetcher]);
  const fetchDatasets = useMemo(() => createAssetFetcher('datasets'), [createAssetFetcher]);
  const fetchAnalyses = useMemo(() => createAssetFetcher('analyses'), [createAssetFetcher]);
  const fetchDatasources = useMemo(() => createAssetFetcher('datasources'), [createAssetFetcher]);
  const fetchFolders = useMemo(() => createAssetFetcher('folders'), [createAssetFetcher]);
  const fetchUsers = useMemo(() => createAssetFetcher('users'), [createAssetFetcher]);
  const fetchGroups = useMemo(() => createAssetFetcher('groups'), [createAssetFetcher]);

  // Refresh export summary
  const refreshExportSummary = useCallback(async () => {
    await refetchSummary();
  }, [refetchSummary]);

  // Refresh specific asset type - invalidates cache and signals tables to re-fetch with current params
  const refreshAssetType = useCallback(async (assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group') => {
    const pluralType = ASSET_TYPE_MAP[assetType] as keyof typeof ASSET_CONFIGS;
    const config = ASSET_CONFIGS[pluralType];

    await queryClient.invalidateQueries({ queryKey: [config.queryKey] });

    // Increment refreshKey to trigger tables to re-fetch with their current sort/filter/search params
    setRefreshKey(prev => prev + 1);

    // The immediate refetch can land inside the backend's per-container
    // revalidation window and read the pre-mutation list; refresh once more
    // just past the window so the table always converges on server truth.
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: [config.queryKey] }).then(() => {
        setRefreshKey(prev => prev + 1);
      });
    }, BACKEND_REVALIDATE_WINDOW_MS);
  }, [queryClient]);

  // Optimistically remove deleted assets from the visible list and every
  // cached page, so a delete disappears immediately regardless of backend
  // cache timing. The refreshAssetType that follows reconciles with the
  // server (including its delayed post-window pass).
  const removeAssets = useCallback((assetType: string, assetIds: string[]) => {
    const pluralType = ASSET_TYPE_MAP[assetType] as keyof typeof ASSET_CONFIGS | undefined;
    if (!pluralType || assetIds.length === 0) return;

    const ids = new Set(assetIds);
    const setters = stateSetters[pluralType];
    if (setters) {
      setters.setData((prev: AssetData[]) => removeAssetsFromItems(prev, ids) || prev);
    }

    // Write through to the query cache too — otherwise a later cache hit for
    // the same key would resurrect the deleted rows
    const config = ASSET_CONFIGS[pluralType];
    if (config) {
      queryClient.setQueriesData({ queryKey: [config.queryKey] }, (old: any) =>
        old
          ? { ...old, [config.dataKey]: removeAssetsFromItems(old[config.dataKey], ids) }
          : old
      );
    }
  }, [stateSetters, queryClient]);

  // Update tags for a specific asset (optimistic update) - simplified with map
  const updateAssetTags = useCallback((assetType: string, assetId: string, tags: any[]) => {
    const pluralType = ASSET_TYPE_MAP[assetType] as keyof typeof stateSetters | undefined;
    if (!pluralType) return;

    const setters = stateSetters[pluralType];
    if (setters) {
      setters.setData((prev: AssetData[]) => applyTagsToItems(prev, assetId, tags) || prev);
    }

    // Write through to the query cache too — otherwise a later cache hit for
    // the same key would silently revert the optimistic edit
    const config = ASSET_CONFIGS[pluralType];
    if (config) {
      queryClient.setQueriesData({ queryKey: [config.queryKey] }, (old: any) =>
        old
          ? { ...old, [config.dataKey]: applyTagsToItems(old[config.dataKey], assetId, tags) }
          : old
      );
    }
  }, [stateSetters, queryClient]);

  // Memoized so consumers only re-render when state actually changes,
  // not on every provider render
  const value: AssetsContextType = useMemo(
    () => ({
      refreshKey,
      exportSummary,
      exportSummaryLoading,
      dashboards,
      dashboardsLoading,
      dashboardsPagination,
      datasets,
      datasetsLoading,
      datasetsPagination,
      analyses,
      analysesLoading,
      analysesPagination,
      datasources,
      datasourcesLoading,
      datasourcesPagination,
      folders,
      foldersLoading,
      foldersPagination,
      users,
      usersLoading,
      usersPagination,
      groups,
      groupsLoading,
      groupsPagination,
      fetchDashboards,
      fetchDatasets,
      fetchAnalyses,
      fetchDatasources,
      fetchFolders,
      fetchUsers,
      fetchGroups,
      availableRoles,
      availableGroups,
      availableSourceTypes,
      refreshExportSummary,
      refreshAssetType,
      updateAssetTags,
      removeAssets,
    }),
    [
      refreshKey,
      exportSummary,
      exportSummaryLoading,
      dashboards,
      dashboardsLoading,
      dashboardsPagination,
      datasets,
      datasetsLoading,
      datasetsPagination,
      analyses,
      analysesLoading,
      analysesPagination,
      datasources,
      datasourcesLoading,
      datasourcesPagination,
      folders,
      foldersLoading,
      foldersPagination,
      users,
      usersLoading,
      usersPagination,
      groups,
      groupsLoading,
      groupsPagination,
      fetchDashboards,
      fetchDatasets,
      fetchAnalyses,
      fetchDatasources,
      fetchFolders,
      fetchUsers,
      fetchGroups,
      availableRoles,
      availableGroups,
      availableSourceTypes,
      refreshExportSummary,
      refreshAssetType,
      updateAssetTags,
      removeAssets,
    ]
  );

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
};
