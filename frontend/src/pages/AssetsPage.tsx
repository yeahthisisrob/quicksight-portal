import { Add as AddIcon } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';

import { ActivityStatsDialog, UserActivityDialog } from '@/widgets/activity-stats';

import { CreateGroupDialog } from '@/features/organization';

import { useAssets } from '@/entities/asset';

import { dataCatalogApi, assetsApi } from '@/shared/api';

import GenericAssetPage from './GenericAssetPage';

const assetConfigs = {
  dashboards: {
    title: 'Dashboards',
    subtitle: 'Manage and explore your QuickSight dashboards',
    assetType: 'dashboard' as const,
  },
  analyses: {
    title: 'Analyses',
    subtitle: 'Manage and explore your QuickSight analyses',
    assetType: 'analysis' as const,
  },
  datasets: {
    title: 'Datasets',
    subtitle: 'Manage and explore your QuickSight datasets',
    assetType: 'dataset' as const,
  },
  datasources: {
    title: 'Data Sources',
    subtitle: 'Manage and explore your QuickSight data sources',
    assetType: 'datasource' as const,
  },
  folders: {
    title: 'Folders',
    subtitle: 'Manage and organize your QuickSight folders',
    assetType: 'folder' as const,
  },
  users: {
    title: 'Users',
    subtitle: 'Manage QuickSight users and their permissions',
    assetType: 'user' as const,
  },
  groups: {
    title: 'Groups',
    subtitle: 'Manage QuickSight user groups',
    assetType: 'group' as const,
  },
};

export default function AssetsPage() {
  const { type } = useParams<{ type: string }>();
  
  const { 
    dashboards, dashboardsLoading, dashboardsPagination, fetchDashboards,
    analyses, analysesLoading, analysesPagination, fetchAnalyses,
    datasets, datasetsLoading, datasetsPagination, fetchDatasets,
    datasources, datasourcesLoading, datasourcesPagination, fetchDatasources,
    folders, foldersLoading, foldersPagination, fetchFolders,
    users, usersLoading, usersPagination, fetchUsers,
    groups, groupsLoading, groupsPagination, fetchGroups,
    refreshAssetType,
    updateAssetTags
  } = useAssets();

  // Activity state
  const [activityDialog, setActivityDialog] = useState<{ 
    open: boolean; 
    asset?: any;
    activity?: any;
  }>({ open: false });
  
  // Group creation state
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  // Fetch available tags for filtering
  const { data: availableTags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['available-tags'],
    queryFn: () => dataCatalogApi.getAvailableTags(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch available folders for filtering
  const { data: availableFolders = [], isLoading: filterFoldersLoading } = useQuery({
    queryKey: ['available-folders-filter'],
    queryFn: async () => {
      const response = await assetsApi.getFoldersPaginated({ page: 1, pageSize: 500 });
      return (response.folders || []).map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        assetCount: folder.memberCount || 0,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const config = type ? assetConfigs[type as keyof typeof assetConfigs] : null;
  
  if (!config) {
    return <Navigate to="/assets/dashboards" replace />;
  }

  // Select the right data based on asset type
  const assetData = {
    dashboard: { assets: dashboards, loading: dashboardsLoading, pagination: dashboardsPagination, fetch: fetchDashboards },
    analysis: { assets: analyses, loading: analysesLoading, pagination: analysesPagination, fetch: fetchAnalyses },
    dataset: { assets: datasets, loading: datasetsLoading, pagination: datasetsPagination, fetch: fetchDatasets },
    datasource: { assets: datasources, loading: datasourcesLoading, pagination: datasourcesPagination, fetch: fetchDatasources },
    folder: { assets: folders, loading: foldersLoading, pagination: foldersPagination, fetch: fetchFolders },
    user: { assets: users, loading: usersLoading, pagination: usersPagination, fetch: fetchUsers },
    group: { assets: groups, loading: groupsLoading, pagination: groupsPagination, fetch: fetchGroups },
  };

  const { assets, loading, pagination, fetch } = assetData[config.assetType] || assetData.dashboard;

  const extraToolbarActions = config.assetType === 'group' ? (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => setCreateGroupOpen(true)}
      size="small"
    >
      Create Group
    </Button>
  ) : undefined;

  return (
    <>
      <GenericAssetPage
        assetType={config.assetType}
        title={config.title}
        subtitle={config.subtitle}
        assets={assets}
        loading={loading}
        pagination={pagination}
        fetchAssets={fetch}
        refreshAssetType={refreshAssetType}
        updateAssetTags={updateAssetTags}
        onActivityClick={(config.assetType === 'dashboard' || config.assetType === 'analysis' || config.assetType === 'user') ?
          (asset) => setActivityDialog({
            open: true,
            asset
          }) : undefined
        }
        extraToolbarActions={extraToolbarActions}
        enableTagFiltering={['dashboard', 'analysis', 'dataset', 'datasource', 'folder'].includes(config.assetType)}
        availableTags={availableTags}
        isLoadingTags={tagsLoading}
        enableErrorFiltering={['dashboard', 'analysis', 'dataset', 'datasource'].includes(config.assetType)}
        enableActivityFiltering={['dashboard', 'analysis'].includes(config.assetType)}
        enableFolderFiltering={['dashboard', 'analysis', 'dataset', 'datasource'].includes(config.assetType)}
        availableFolders={availableFolders}
        isLoadingFolders={filterFoldersLoading}
      />
      
      {/* Activity dialog for dashboards and analyses */}
      {(config.assetType === 'dashboard' || config.assetType === 'analysis') && activityDialog.asset && (
        <ActivityStatsDialog
          open={activityDialog.open}
          onClose={() => setActivityDialog({ open: false })}
          assetName={activityDialog.asset.name}
          assetType={config.assetType as 'dashboard' | 'analysis'}
          assetId={activityDialog.asset.id}
        />
      )}
      
      {/* User activity dialog */}
      {config.assetType === 'user' && activityDialog.asset && (
        <UserActivityDialog
          open={activityDialog.open}
          onClose={() => setActivityDialog({ open: false })}
          userName={activityDialog.asset.name || activityDialog.asset.email}
          userId={activityDialog.asset.id}
        />
      )}
      
      {/* Create Group Dialog */}
      {config.assetType === 'group' && (
        <CreateGroupDialog
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          onSuccess={() => {
            setCreateGroupOpen(false);
            refreshAssetType('group');
          }}
        />
      )}
    </>
  );
}