import { ContentCopy as CopyIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Tooltip,
  Typography,
} from '@mui/material';
import type { GridRowSelectionModel } from '@mui/x-data-grid';
import type { components } from '@shared/generated/types';
import { format } from 'date-fns';
import { useCallback, useState } from 'react';

import type { ArchivedAssetItem as LocalArchivedAssetItem } from '@/features/asset-management';
import { copyToClipboard, EnhancedAssetTable } from '@/widgets/asset-table';
import { RestoreAssetDialog } from '@/widgets/restore-asset-dialog';

import { assetsApi } from '@/shared/api';
import { pal } from '@/shared/design-system';
import { EMPTY_SELECTION } from '@/shared/lib/gridSelection';
import { assetIcons } from '@/shared/ui/icons';
import { JsonViewerModal } from '@/shared/ui/JsonViewer';

type ArchivedAssetItem = components['schemas']['ArchivedAssetItem'];
type AssetType = components['schemas']['AssetType'];

const DATE_FORMAT = 'MMM dd, yyyy HH:mm';
const formatDate = (value?: string | null) => (value ? format(new Date(value), DATE_FORMAT) : '-');

function ArchivedActionsMenu({
  asset,
  onRestore,
  onViewJson,
}: {
  asset: ArchivedAssetItem;
  onRestore: (a: ArchivedAssetItem) => void;
  onViewJson: (a: ArchivedAssetItem) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Actions"
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
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
        <MenuItem
          onClick={() => {
            onRestore(asset);
            setAnchorEl(null);
          }}
        >
          Restore Asset
        </MenuItem>
        <MenuItem
          onClick={() => {
            onViewJson(asset);
            setAnchorEl(null);
          }}
        >
          View JSON
        </MenuItem>
      </Menu>
    </>
  );
}

/** A type chip coloured from the theme's asset palette. */
function AssetTypeChip({ type }: { type: AssetType }) {
  const Icon = assetIcons[type];
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 16 }} />}
      label={type}
      size="small"
      sx={(theme) => ({
        backgroundColor: pal(theme).asset[type].subtle,
        color: pal(theme).asset[type].strong,
        '& .MuiChip-icon': { color: pal(theme).asset[type].main },
      })}
    />
  );
}

export interface ArchivedAssetsPanelProps {
  /** Called with the total after each fetch, so a host can show a count. */
  onTotalChange?: (total: number) => void;
}

/**
 * Deleted assets the portal kept a copy of, with restore and JSON viewing.
 */
export function ArchivedAssetsPanel({ onTotalChange }: ArchivedAssetsPanelProps) {
  const [assets, setAssets] = useState<ArchivedAssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<ArchivedAssetItem | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [assetToRestore, setAssetToRestore] = useState<LocalArchivedAssetItem | null>(null);

  const fetchAssets = useCallback(
    async (options: {
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
        onTotalChange?.(response.totalCount);
      } catch (error) {
        console.error('Failed to fetch archived assets:', error);
      } finally {
        setLoading(false);
      }
    },
    [selectedType, onTotalChange]
  );

  const handleViewJson = (asset: ArchivedAssetItem) => {
    setSelectedAsset(asset);
    setJsonViewerOpen(true);
  };

  const handleRestore = (asset: ArchivedAssetItem) => {
    setAssetToRestore(asset);
    setRestoreDialogOpen(true);
  };

  const handleRestoreSuccess = () => {
    // Restore keeps the archive copy; the dialog invalidates the active lists.
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
        <ArchivedActionsMenu
          asset={params.row}
          onRestore={handleRestore}
          onViewJson={handleViewJson}
        />
      ),
    },
    { id: 'name', label: 'Name', flex: 1, minWidth: 200, required: true },
    {
      id: 'id',
      label: 'Asset ID',
      flex: 1,
      minWidth: 200,
      renderCell: (params: any) => {
        const fullId = params.value || '';
        const shortId = fullId.length > 15 ? `${fullId.slice(0, 8)}...${fullId.slice(-4)}` : fullId;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={fullId}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {shortId}
              </Typography>
            </Tooltip>
            <IconButton
              size="small"
              aria-label="Copy id"
              onClick={() => copyToClipboard(fullId)}
              sx={{ padding: '2px' }}
            >
              <CopyIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Box>
        );
      },
    },
    {
      id: 'type',
      label: 'Type',
      width: 130,
      required: true,
      renderCell: (params: any) => <AssetTypeChip type={params.row.type} />,
    },
    {
      id: 'createdTime',
      label: 'Created',
      width: 180,
      valueGetter: (params: any) => formatDate(params.row.createdTime),
    },
    {
      id: 'lastUpdatedTime',
      label: 'Last Updated',
      width: 180,
      valueGetter: (params: any) => formatDate(params.row.lastUpdatedTime),
    },
    {
      id: 'lastExportTime',
      label: 'Last Exported',
      width: 180,
      visible: false,
      valueGetter: (params: any) => formatDate(params.row.lastExportTime),
    },
    {
      id: 'lastActivity',
      label: 'Last Activity',
      width: 180,
      valueGetter: (params: any) => formatDate(params.row.lastActivity),
    },
    {
      id: 'archivedDate',
      label: 'Archived',
      width: 180,
      required: true,
      valueGetter: (params: any) => formatDate(params.row.archivedDate),
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
    { id: 'archivedBy', label: 'Archived By', width: 120 },
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
    <>
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
    </>
  );
}

export default ArchivedAssetsPanel;
