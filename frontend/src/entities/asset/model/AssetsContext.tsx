/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
  fetchDashboards: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
  fetchDatasets: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
  fetchAnalyses: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
  fetchDatasources: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
  fetchFolders: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
  fetchUsers: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
  fetchGroups: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
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

export const AssetsProvider: React.FC<AssetsProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  
  // State for each asset type
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
  
  // Create a key for deduplication
  const createRequestKey = (
    type: string,
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string
  ) => {
    return `${type}-${page}-${pageSize}-${search || ''}-${dateRange || ''}-${sortBy || ''}-${sortOrder || ''}`;
  };
  
  // Fetch dashboards with deduplication
  const fetchDashboards = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    const requestKey = createRequestKey('dashboards', page, pageSize, search, dateRange, sortBy, sortOrder);
    setDashboardsLoading(true);
    
    try {
      const data = await requestManager.execute(requestKey, () => 
        assetsApi.getDashboardsPaginated({ page, pageSize, search, dateRange, sortBy, sortOrder, filters })
      );
      setDashboards(data.dashboards || []);
      setDashboardsPagination(data.pagination);
    } catch (_error) {
      setDashboards([]);
    } finally {
      setDashboardsLoading(false);
    }
  }, []);
  
  // Fetch datasets with deduplication
  const fetchDatasets = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    const requestKey = createRequestKey('datasets', page, pageSize, search, dateRange, sortBy, sortOrder);
    setDatasetsLoading(true);
    
    try {
      const data = await requestManager.execute(requestKey, () =>
        assetsApi.getDatasetsPaginated({ page, pageSize, search, dateRange, sortBy, sortOrder, filters })
      );
      setDatasets(data.datasets || []);
      setDatasetsPagination(data.pagination);
    } catch (_error) {
      setDatasets([]);
    } finally {
      setDatasetsLoading(false);
    }
  }, []);
  
  // Fetch analyses with deduplication
  const fetchAnalyses = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    const requestKey = createRequestKey('analyses', page, pageSize, search, dateRange, sortBy, sortOrder);
    setAnalysesLoading(true);
    
    try {
      const data = await requestManager.execute(requestKey, () =>
        assetsApi.getAnalysesPaginated({ page, pageSize, search, dateRange, sortBy, sortOrder, filters })
      );
      setAnalyses(data.analyses || []);
      setAnalysesPagination(data.pagination);
    } catch (_error) {
      setAnalyses([]);
    } finally {
      setAnalysesLoading(false);
    }
  }, []);
  
  // Fetch datasources with deduplication
  const fetchDatasources = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    const requestKey = createRequestKey('datasources', page, pageSize, search, dateRange, sortBy, sortOrder);
    setDatasourcesLoading(true);
    
    try {
      const data = await requestManager.execute(requestKey, () =>
        assetsApi.getDatasourcesPaginated({ page, pageSize, search, dateRange, sortBy, sortOrder, filters })
      );
      setDatasources(data.datasources || []);
      setDatasourcesPagination(data.pagination);
    } catch (_error) {
      setDatasources([]);
    } finally {
      setDatasourcesLoading(false);
    }
  }, []);
  
  // Fetch folders with deduplication
  const fetchFolders = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    _dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    setFoldersLoading(true);
    
    try {
      // Use assets API for folders (DRY - everything comes from cache)
      const data = await requestManager.execute(
        `folders-${page}-${pageSize}-${search || ''}-${sortBy || ''}-${sortOrder || ''}`,
        () => assetsApi.getFoldersPaginated({ page, pageSize, search, sortBy, sortOrder, filters })
      );
      
      const allFolders = data.folders || [];
      
      // Folders are already mapped by backend
      const transformedFolders = allFolders;
      
      setFolders(transformedFolders);
      setFoldersPagination(data.pagination || {
        page,
        pageSize,
        totalItems: transformedFolders.length,
        totalPages: Math.ceil(transformedFolders.length / pageSize),
        hasMore: false
      });
    } catch (_error) {
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  }, []);
  
  // Fetch users with deduplication
  const fetchUsers = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    setUsersLoading(true);
    
    try {
      // Use assets API for users (DRY - everything comes from cache)
      const data = await requestManager.execute(
        `users-${page}-${pageSize}-${search || ''}-${dateRange || ''}-${sortBy || ''}-${sortOrder || ''}`,
        () => assetsApi.getUsersPaginated({ page, pageSize, search, dateRange, sortBy, sortOrder, filters })
      );
      
      const allUsers = data.users || [];
      
      // Users are already mapped by backend
      const transformedUsers = allUsers;
      
      setUsers(transformedUsers);
      setUsersPagination(data.pagination || {
        page,
        pageSize,
        totalItems: transformedUsers.length,
        totalPages: Math.ceil(transformedUsers.length / pageSize),
        hasMore: false
      });
    } catch (_error) {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);
  
  // Fetch groups with deduplication
  const fetchGroups = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string,
    filters?: Record<string, any>
  ) => {
    setGroupsLoading(true);
    
    try {
      // Use the assets API like other asset types
      const data = await requestManager.execute(
        `groups-${page}-${pageSize}-${search || ''}-${dateRange || ''}-${sortBy || ''}-${sortOrder || ''}`,
        () => assetsApi.getGroupsPaginated({ page, pageSize, search, dateRange, sortBy, sortOrder, filters })
      );
      
      // Groups are already mapped by backend
      const transformedGroups = data.groups || [];
      
      setGroups(transformedGroups);
      setGroupsPagination({
        page: data.pagination?.page || page,
        pageSize: data.pagination?.pageSize || pageSize,
        totalPages: data.pagination?.totalPages || 1,
        totalItems: data.pagination?.totalItems || transformedGroups.length,
        hasMore: data.pagination?.hasMore || false
      });
    } catch (_error) {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);
  
  // Refresh export summary
  const refreshExportSummary = useCallback(async () => {
    await refetchSummary();
  }, [refetchSummary]);
  
  // Refresh specific asset type
  const refreshAssetType = useCallback(async (assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group') => {
    // Invalidate relevant queries based on asset type
    switch (assetType) {
      case 'dashboard':
        await queryClient.invalidateQueries({ queryKey: ['dashboards-paginated'] });
        // Force refetch the current page data
        if (dashboardsPagination) {
          await fetchDashboards(dashboardsPagination.page, dashboardsPagination.pageSize);
        }
        break;
      case 'dataset':
        await queryClient.invalidateQueries({ queryKey: ['datasets-paginated'] });
        // Force refetch the current page data
        if (datasetsPagination) {
          await fetchDatasets(datasetsPagination.page, datasetsPagination.pageSize);
        }
        break;
      case 'analysis':
        await queryClient.invalidateQueries({ queryKey: ['analyses-paginated'] });
        // Force refetch the current page data
        if (analysesPagination) {
          await fetchAnalyses(analysesPagination.page, analysesPagination.pageSize);
        }
        break;
      case 'datasource':
        await queryClient.invalidateQueries({ queryKey: ['datasources-paginated'] });
        // Force refetch the current page data
        if (datasourcesPagination) {
          await fetchDatasources(datasourcesPagination.page, datasourcesPagination.pageSize);
        }
        break;
      case 'folder':
        await queryClient.invalidateQueries({ queryKey: ['folders-list'] });
        // Force refetch the current page data
        if (foldersPagination) {
          await fetchFolders(foldersPagination.page, foldersPagination.pageSize);
        }
        break;
      case 'user':
        await queryClient.invalidateQueries({ queryKey: ['users-list'] });
        // Force refetch the current page data
        if (usersPagination) {
          await fetchUsers(usersPagination.page, usersPagination.pageSize);
        }
        break;
      case 'group':
        await queryClient.invalidateQueries({ queryKey: ['groups'] });
        // Force refetch the current page data
        if (groupsPagination) {
          await fetchGroups(groupsPagination.page, groupsPagination.pageSize);
        }
        break;
    }
  }, [queryClient, dashboardsPagination, datasetsPagination, analysesPagination, datasourcesPagination,
      foldersPagination, usersPagination, groupsPagination,
      fetchDashboards, fetchDatasets, fetchAnalyses, fetchDatasources, fetchFolders, fetchUsers, fetchGroups]);
  
  // Update tags for a specific asset (optimistic update)
  const updateAssetTags = useCallback((assetType: string, assetId: string, tags: any[]) => {
    // Optimistically update the local state immediately
    switch (assetType) {
      case 'dashboard':
        setDashboards(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
      case 'dataset':
        setDatasets(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
      case 'analysis':
        setAnalyses(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
      case 'datasource':
        setDatasources(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
      case 'folder':
        setFolders(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
      case 'user':
        setUsers(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
      case 'group':
        setGroups(prev => prev.map(item => 
          item.id === assetId ? { ...item, tags } : item
        ));
        break;
    }
  }, []);
  
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