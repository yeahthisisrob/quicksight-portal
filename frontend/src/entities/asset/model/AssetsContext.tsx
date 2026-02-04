/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

import { assetsApi, requestManager } from '@/shared/api';

interface AssetData {
  id: string;
  name: string;
  type: string;
  lastExportTime: string;  // Matches backend field name
  permissions?: any[];
  tags?: any[];
  metadata?: any;
  [key: string]: any;  // Allows additional fields from backend
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore?: boolean;  // Made optional to match backend
}

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
}

const AssetsContext = createContext<AssetsContextType | undefined>(undefined);

export const useAssets = () => {
  const context = useContext(AssetsContext);
  if (!context) {
    throw new Error('useAssets must be used within an AssetsProvider');
  }
  return context;
};

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

  // Export summary query with proper caching
  const { data: exportSummary, isLoading: exportSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['export-summary'],
    queryFn: () => requestManager.execute('export-summary', () => assetsApi.getExportSummary()),
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

  // Pagination getters for refresh
  const paginationGetters = useMemo(() => ({
    dashboards: dashboardsPagination,
    datasets: datasetsPagination,
    analyses: analysesPagination,
    datasources: datasourcesPagination,
    folders: foldersPagination,
    users: usersPagination,
    groups: groupsPagination,
  }), [dashboardsPagination, datasetsPagination, analysesPagination, datasourcesPagination, foldersPagination, usersPagination, groupsPagination]);

  // Create a key for deduplication
  const createRequestKey = useCallback((type: string, options: FetchParams) => {
    const { page, pageSize, search, dateRange, sortBy, sortOrder, dateField, includeTags, excludeTags } = options;
    return `${type}-${page}-${pageSize}-${search || ''}-${dateRange || ''}-${sortBy || ''}-${sortOrder || ''}-${dateField || ''}-${includeTags || ''}-${excludeTags || ''}`;
  }, []);

  // Factory function to create fetch methods - eliminates 7 duplicate implementations
  const createAssetFetcher = useCallback((assetType: keyof typeof ASSET_CONFIGS): AssetFetchFn => {
    const config = ASSET_CONFIGS[assetType];
    const setters = stateSetters[assetType];

    return async (options: FetchParams) => {
      const { page, pageSize } = options;
      const requestKey = createRequestKey(config.key, options);
      setters.setLoading(true);

      try {
        const data = await requestManager.execute(requestKey, () =>
          config.apiMethod(options)
        );

        const items = data[config.dataKey] || [];
        setters.setData(items);

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
  }, [createRequestKey, stateSetters]);

  // Create all fetch methods using the factory
  const fetchDashboards = useMemo(() => createAssetFetcher('dashboards'), [createAssetFetcher]);
  const fetchDatasets = useMemo(() => createAssetFetcher('datasets'), [createAssetFetcher]);
  const fetchAnalyses = useMemo(() => createAssetFetcher('analyses'), [createAssetFetcher]);
  const fetchDatasources = useMemo(() => createAssetFetcher('datasources'), [createAssetFetcher]);
  const fetchFolders = useMemo(() => createAssetFetcher('folders'), [createAssetFetcher]);
  const fetchUsers = useMemo(() => createAssetFetcher('users'), [createAssetFetcher]);
  const fetchGroups = useMemo(() => createAssetFetcher('groups'), [createAssetFetcher]);

  // Map of fetch functions for refreshAssetType
  const fetchFunctions = useMemo(() => ({
    dashboards: fetchDashboards,
    datasets: fetchDatasets,
    analyses: fetchAnalyses,
    datasources: fetchDatasources,
    folders: fetchFolders,
    users: fetchUsers,
    groups: fetchGroups,
  }), [fetchDashboards, fetchDatasets, fetchAnalyses, fetchDatasources, fetchFolders, fetchUsers, fetchGroups]);

  // Refresh export summary
  const refreshExportSummary = useCallback(async () => {
    await refetchSummary();
  }, [refetchSummary]);

  // Refresh specific asset type - simplified with config-driven approach
  const refreshAssetType = useCallback(async (assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group') => {
    const pluralType = ASSET_TYPE_MAP[assetType] as keyof typeof ASSET_CONFIGS;
    const config = ASSET_CONFIGS[pluralType];
    const pagination = paginationGetters[pluralType];
    const fetchFn = fetchFunctions[pluralType];

    await queryClient.invalidateQueries({ queryKey: [config.queryKey] });

    if (pagination) {
      await fetchFn({ page: pagination.page, pageSize: pagination.pageSize });
    }
  }, [queryClient, paginationGetters, fetchFunctions]);

  // Update tags for a specific asset (optimistic update) - simplified with map
  const updateAssetTags = useCallback((assetType: string, assetId: string, tags: any[]) => {
    const pluralType = ASSET_TYPE_MAP[assetType] as keyof typeof stateSetters | undefined;
    if (!pluralType) return;

    const setters = stateSetters[pluralType];
    if (setters) {
      setters.setData((prev: AssetData[]) => prev.map(item =>
        item.id === assetId ? { ...item, tags } : item
      ));
    }
  }, [stateSetters]);

  const value: AssetsContextType = {
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
    refreshExportSummary,
    refreshAssetType,
    updateAssetTags,
  };

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
};
