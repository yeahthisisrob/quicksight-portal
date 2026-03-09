import { ContentCopy as CopyIcon, Dashboard, Analytics, Dataset, Storage, Folder, Person, Group, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { Box, Typography, Chip, Tooltip, IconButton, Menu, MenuItem, Select, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { format } from 'date-fns';
import React, { useState, useCallback } from 'react';

import { EnhancedAssetTable , copyToClipboard } from '@/widgets/asset-table';

import { RestoreAssetDialog } from '@/features/asset-management/ui/RestoreAssetDialog';


import { assetsApi } from '@/shared/api';
import { PageLayout } from '@/shared/ui';
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

function ArchivedActionsMenu({ asset, onRestore, onViewJson }: {
  asset: ArchivedAssetItem;
  onRestore: (a: ArchivedAssetItem) => void;
  onViewJson: (a: ArchivedAssetItem) => void;
}) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        sx={{ color: 'text.secondary', padding: '4px' }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { onRestore(asset); setAnchorEl(null); }}>
          Restore Asset
        </MenuItem>
        <MenuItem onClick={() => { onViewJson(asset); setAnchorEl(null); }}>
          View JSON
        </MenuItem>
      </Menu>
    </>
  );
}

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

  const fetchAssets = useCallback(async (options: {
    page: number;
    pageSize: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const { page, pageSize, search, dateRange, sortBy, sortOrder } = options;
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
    fetchAssets({ page: 1, pageSize: 50 });
  };

  const columns = [
    {
      id: 'actions',
      label: ' ',
      width: 50,
      sortable: false,
      required: true,
      renderCell: (params: any) => (
        <ArchivedActionsMenu asset={params.row} onRestore={handleRestore} onViewJson={handleViewJson} />
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
      flex: 1,
      minWidth: 200,
      renderCell: (params: any) => {
        const fullId = params.value || '';
        const shortId = fullId.length > 15
          ? `${fullId.slice(0, 8)}...${fullId.slice(-4)}`
          : fullId;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={fullId}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {shortId}
              </Typography>
            </Tooltip>
            <IconButton size="small" onClick={() => copyToClipboard(fullId)} sx={{ padding: '2px' }}>
              <CopyIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Box>
        );
      },
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
    <PageLayout title="Archived Assets" totalRows={totalRows}>
      <EnhancedAssetTable
        assets={assets}
        loading={loading}
        totalRows={totalRows}
        columns={columns}
        onFetchAssets={fetchAssets}
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
    </PageLayout>
  );
};