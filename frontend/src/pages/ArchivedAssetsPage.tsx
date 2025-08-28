import { Archive, Code, Dashboard, Analytics, Dataset, Storage, Folder, Person, Group, RestoreFromTrash } from '@mui/icons-material';
import { Box, Typography, Chip, Tooltip, IconButton, MenuItem, Select, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { format } from 'date-fns';
import React, { useState, useCallback } from 'react';

import { EnhancedAssetTable } from '@/widgets/asset-table';

import { RestoreAssetDialog } from '@/features/asset-management/ui/RestoreAssetDialog';

import { assetsApi } from '@/shared/api';
import { JsonViewerModal } from '@/shared/ui/JsonViewer';

import type { ArchivedAssetItem as LocalArchivedAssetItem } from '@/features/asset-management';
import type { components } from '@shared/generated/types';

type ArchivedAssetItem = components['schemas']['ArchivedAssetItem'];
type AssetType = components['schemas']['AssetType'];

const ASSET_TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  dashboard: <Dashboard sx={{ fontSize: 16 }} />,
  analysis: <Analytics sx={{ fontSize: 16 }} />,
  dataset: <Dataset sx={{ fontSize: 16 }} />,
  datasource: <Storage sx={{ fontSize: 16 }} />,
  folder: <Folder sx={{ fontSize: 16 }} />,
  user: <Person sx={{ fontSize: 16 }} />,
  group: <Group sx={{ fontSize: 16 }} />,
};

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  dashboard: '#1976d2',
  analysis: '#9c27b0',
  dataset: '#ed6c02',
  datasource: '#2e7d32',
  folder: '#757575',
  user: '#0288d1',
  group: '#7b1fa2',
};

export const ArchivedAssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<ArchivedAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<ArchivedAssetItem | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [assetToRestore, setAssetToRestore] = useState<LocalArchivedAssetItem | null>(null);

  const fetchAssets = useCallback(async (
    page: number,
    pageSize: number,
    search?: string,
    dateRange?: string,
    sortBy?: string,
    sortOrder?: string
  ) => {
    setLoading(true);
    try {
      const response = await assetsApi.getArchivedAssetsPaginated({
        type: selectedType === 'all' ? undefined : selectedType,
        page,
        pageSize,
        search,
        dateRange,
        sortBy,
        sortOrder,
      });
      setAssets(response.items);
      setTotalRows(response.totalCount);
    } catch (error) {
      console.error('Failed to fetch archived assets:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  const handleRefreshAssets = async () => {
    // Archived assets don't need refresh - they're already cached
    await fetchAssets(1, 50);
  };

  const handleViewJson = (asset: ArchivedAssetItem) => {
    setSelectedAsset(asset);
    setJsonViewerOpen(true);
  };

  const handleRestore = (asset: ArchivedAssetItem) => {
    // Convert to local type
    const localAsset: LocalArchivedAssetItem = {
      type: asset.type,
      id: asset.id,
      name: asset.name,
      createdTime: asset.createdTime,
      lastUpdatedTime: asset.lastUpdatedTime,
      lastExportTime: asset.lastExportTime,
      lastActivity: typeof asset.lastActivity === 'string' ? asset.lastActivity : undefined,
      archivedDate: asset.archivedDate,
      archiveReason: asset.archiveReason,
      archivedBy: asset.archivedBy,
      tags: asset.tags?.map(t => ({ key: t.key || '', value: t.value || '' })) || [],
    };
    setAssetToRestore(localAsset);
    setRestoreDialogOpen(true);
  };

  const handleRestoreSuccess = () => {
    // Refresh the archived assets list
    fetchAssets(1, 50);
  };

  const columns = [
    {
      id: 'actions',
      label: 'Actions',
      width: 100,
      sortable: false,
      required: true,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Restore Asset">
            <IconButton size="small" onClick={() => handleRestore(params.row)} color="primary">
              <RestoreFromTrash fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View JSON">
            <IconButton size="small" onClick={() => handleViewJson(params.row)}>
              <Code fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
    {
      id: 'name',
      label: 'Name',
      flex: 1,
      minWidth: 200,
      required: true,
    },
    {
      id: 'id',
      label: 'Asset ID',
      width: 300,
      renderCell: (params: any) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      width: 120,
      required: true,
      renderCell: (params: any) => {
        const type = params.row.type;
        return (
          <Chip
            icon={ASSET_TYPE_ICONS[type] as any}
            label={type}
            size="small"
            sx={{
              backgroundColor: `${ASSET_TYPE_COLORS[type]}20`,
              color: ASSET_TYPE_COLORS[type],
              fontWeight: 500,
            }}
          />
        );
      },
    },
    {
      id: 'createdTime',
      label: 'Created',
      width: 180,
      valueGetter: (params: any) =>
        params.row.createdTime ? format(new Date(params.row.createdTime), 'MMM dd, yyyy HH:mm') : '-',
    },
    {
      id: 'lastUpdatedTime',
      label: 'Last Updated',
      width: 180,
      valueGetter: (params: any) =>
        params.row.lastUpdatedTime
          ? format(new Date(params.row.lastUpdatedTime), 'MMM dd, yyyy HH:mm')
          : '-',
    },
    {
      id: 'lastExportTime',
      label: 'Last Exported',
      width: 180,
      visible: false,
      valueGetter: (params: any) =>
        params.row.lastExportTime
          ? format(new Date(params.row.lastExportTime), 'MMM dd, yyyy HH:mm')
          : '-',
    },
    {
      id: 'lastActivity',
      label: 'Last Activity',
      width: 180,
      valueGetter: (params: any) =>
        params.row.lastActivity
          ? format(new Date(params.row.lastActivity), 'MMM dd, yyyy HH:mm')
          : '-',
    },
    {
      id: 'archivedDate',
      label: 'Archived',
      width: 180,
      required: true,
      valueGetter: (params: any) =>
        params.row.archivedDate
          ? format(new Date(params.row.archivedDate), 'MMM dd, yyyy HH:mm')
          : '-',
    },
    {
      id: 'archiveReason',
      label: 'Archive Reason',
      flex: 1,
      minWidth: 200,
      renderCell: (params: any) => (
        <Tooltip title={params.value || ''}>
          <Typography variant="body2" noWrap>
            {params.value}
          </Typography>
        </Tooltip>
      ),
    },
    {
      id: 'archivedBy',
      label: 'Archived By',
      width: 120,
    },
  ];

  const extraToolbarActions = (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel>Asset Type</InputLabel>
      <Select
        value={selectedType}
        onChange={(e: SelectChangeEvent) => setSelectedType(e.target.value as AssetType | 'all')}
        label="Asset Type"
      >
        <MenuItem value="all">All Types</MenuItem>
        <MenuItem value="dashboard">Dashboards</MenuItem>
        <MenuItem value="analysis">Analyses</MenuItem>
        <MenuItem value="dataset">Datasets</MenuItem>
        <MenuItem value="datasource">Datasources</MenuItem>
        <MenuItem value="folder">Folders</MenuItem>
        <MenuItem value="user">Users</MenuItem>
        <MenuItem value="group">Groups</MenuItem>
      </Select>
    </FormControl>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Archive sx={{ fontSize: 32, color: 'text.secondary' }} />
        <Box>
          <Typography variant="h4" component="h1">
            Archived Assets
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage assets that have been deleted from QuickSight and moved to the archive.
          </Typography>
        </Box>
      </Box>

      <EnhancedAssetTable
          title=""
          subtitle=""
          assets={assets}
          loading={loading}
          totalRows={totalRows}
          columns={columns}
          onFetchAssets={fetchAssets}
          onRefreshAssets={handleRefreshAssets}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          enableBulkActions={false}
          defaultPageSize={50}
          defaultSortModel={[{ field: 'archivedDate', sort: 'desc' }]}
          extraToolbarActions={extraToolbarActions}
          getRowId={(row) => `${row.type}-${row.id}`}
        />

        {selectedAsset && (
          <JsonViewerModal
            open={jsonViewerOpen}
            onClose={() => {
              setJsonViewerOpen(false);
              setSelectedAsset(null);
            }}
            assetType={selectedAsset.type}
            assetId={selectedAsset.id}
            assetName={selectedAsset.name}
          />
        )}

        <RestoreAssetDialog
          open={restoreDialogOpen}
          onClose={() => {
            setRestoreDialogOpen(false);
            setAssetToRestore(null);
          }}
          onSuccess={handleRestoreSuccess}
          asset={assetToRestore}
        />
    </Box>
  );
};