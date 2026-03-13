import {
  Cancel,
  CheckCircle,
  CloudQueue,
  Error as ErrorIcon,
  HourglassEmpty,
  MoreVert as MoreVertIcon,
  OpenInNew,
  Refresh,
} from '@mui/icons-material';
import { Alert, Box, Chip, IconButton, Menu, MenuItem, Tooltip, Typography, alpha } from '@mui/material';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import React, { useState, useCallback } from 'react';

import { EnhancedAssetTable, formatBytes, type  ColumnConfig,type  FetchAssetsOptions } from '@/widgets/asset-table';

import { DatasourceTypeBadge } from '@/entities/field';

import { ingestionsApi } from '@/shared/api';
import { colors } from '@/shared/design-system/theme';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';
import { PageLayout } from '@/shared/ui';

import type { components } from '@shared/generated/types';

type Ingestion = components['schemas']['Ingestion'];
type IngestionMetadata = components['schemas']['IngestionListResponse']['data']['metadata'];

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  RUNNING: { label: 'Running', color: colors.status.info, icon: HourglassEmpty },
  COMPLETED: { label: 'Completed', color: colors.status.success, icon: CheckCircle },
  FAILED: { label: 'Failed', color: colors.status.error, icon: ErrorIcon },
  CANCELLED: { label: 'Cancelled', color: colors.neutral[500], icon: Cancel },
  INITIALIZED: { label: 'Initialized', color: colors.neutral[400], icon: CloudQueue },
  QUEUED: { label: 'Queued', color: colors.status.warning, icon: CloudQueue },
};

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function IngestionActionsMenu({ ingestion, onViewDetails, onCancel }: {
  ingestion: Ingestion;
  onViewDetails: (i: Ingestion) => void;
  onCancel: (i: Ingestion) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const canCancel = ['RUNNING', 'QUEUED', 'INITIALIZED'].includes(ingestion.status);

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
        <MenuItem onClick={() => { onViewDetails(ingestion); setAnchorEl(null); }}>
          View Details
        </MenuItem>
        <MenuItem onClick={() => {
          const url = getQuickSightConsoleUrl('dataset', ingestion.datasetId);
          if (url) window.open(url, '_blank');
          setAnchorEl(null);
        }}>
          <OpenInNew sx={{ fontSize: 16, mr: 1 }} />
          Open in QuickSight
        </MenuItem>
        {canCancel && (
          <MenuItem onClick={() => { onCancel(ingestion); setAnchorEl(null); }}>
            Cancel Ingestion
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export default function IngestionsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<IngestionMetadata | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [availableSourceTypes, setAvailableSourceTypes] = useState<Array<{ value: string; count: number }>>([]);

  const fetchIngestions = useCallback(async (options: FetchAssetsOptions) => {
    try {
      setLoading(true);
      const result = await ingestionsApi.list({
        page: options.page,
        pageSize: options.pageSize,
        search: options.search,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder as 'asc' | 'desc' | undefined,
        dateRange: options.dateRange,
        dateField: options.dateField,
        sourceTypeFilter: options.sourceTypeFilter,
      });
      setIngestions(result.ingestions || []);
      setTotalRows(result.pagination?.totalItems || 0);
      setMetadata(result.metadata || null);
      if (result.availableSourceTypes) setAvailableSourceTypes(result.availableSourceTypes);
    } catch (_error) {
      enqueueSnackbar('Failed to load ingestions', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const handleCancelIngestion = async (ingestion: Ingestion) => {
    try {
      await ingestionsApi.cancel(ingestion.datasetId, ingestion.id);
      enqueueSnackbar('Ingestion cancelled successfully', { variant: 'success' });
      setRefreshKey(prev => prev + 1);
    } catch (_error) {
      enqueueSnackbar('Failed to cancel ingestion', { variant: 'error' });
    }
  };

  const handleViewDetails = async (ingestion: Ingestion) => {
    try {
      const details = await ingestionsApi.getDetails(ingestion.datasetId, ingestion.id);
      enqueueSnackbar(
        `Ingestion ${ingestion.id}: ${details.status}${details.errorMessage ? ` - ${details.errorMessage}` : ''}`,
        { variant: 'info' }
      );
    } catch (_error) {
      enqueueSnackbar('Failed to load ingestion details', { variant: 'error' });
    }
  };

  const columns: ColumnConfig[] = [
    {
      id: 'actions',
      label: ' ',
      width: 50,
      sortable: false,
      required: true,
      renderCell: (params: any) => {
        const ingestion = params.row as Ingestion;
        return <IngestionActionsMenu ingestion={ingestion} onViewDetails={handleViewDetails} onCancel={handleCancelIngestion} />;
      },
    },
    {
      id: 'datasetName',
      label: 'Dataset',
      width: 250,
      required: true,
      renderCell: (params: any) => (
        <Tooltip title={params.row.datasetName || params.row.datasetId}>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {params.row.datasetName || params.row.datasetId}
          </Typography>
        </Tooltip>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 140,
      required: true,
      renderCell: (params: any) => {
        const config = statusConfig[params.row.status];
        if (!config) return params.row.status;
        const StatusIcon = config.icon;
        return (
          <Chip
            icon={<StatusIcon sx={{ fontSize: 16 }} />}
            label={config.label}
            size="small"
            sx={{
              backgroundColor: alpha(config.color, 0.1),
              color: config.color,
              '& .MuiChip-icon': { color: config.color },
            }}
          />
        );
      },
    },
    {
      id: 'createdTime',
      label: 'Started',
      width: 180,
      dateFilterField: 'createdTime',
      valueGetter: (params: any) =>
        params.row.createdTime ? format(new Date(params.row.createdTime), 'MMM d, yyyy HH:mm') : '-',
    },
    {
      id: 'ingestionTimeInSeconds',
      label: 'Duration',
      width: 120,
      valueGetter: (params: any) => formatDuration(params.row.ingestionTimeInSeconds),
    },
    {
      id: 'rowsIngested',
      label: 'Rows',
      width: 120,
      valueGetter: (params: any) =>
        params.row.rowsIngested != null ? params.row.rowsIngested.toLocaleString() : '-',
    },
    {
      id: 'datasourceType',
      label: 'Source Type',
      width: 200,
      renderCell: (params: any) =>
        params.row.datasourceType ? (
          <DatasourceTypeBadge
            datasourceType={params.row.datasourceType}
            importMode={params.row.importMode as 'SPICE' | 'DIRECT_QUERY' | undefined}
          />
        ) : '-',
    },
    {
      id: 'sizeInBytes',
      label: 'SPICE Size',
      width: 100,
      renderCell: (params: any) => {
        const size = params.row.sizeInBytes;
        if (!size || params.row.importMode !== 'SPICE') {
          return <Typography variant="body2" color="text.secondary">-</Typography>;
        }
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatBytes(size)}
          </Typography>
        );
      },
    },
  ];

  const extraToolbarActions = (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {metadata && (
        <>
          {metadata.runningIngestions > 0 && (
            <Chip
              icon={<HourglassEmpty />}
              label={`Running: ${metadata.runningIngestions}`}
              size="small"
              sx={{ backgroundColor: alpha(colors.status.info, 0.1) }}
            />
          )}
          {metadata.failedIngestions > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`Failed: ${metadata.failedIngestions}`}
              size="small"
              sx={{ backgroundColor: alpha(colors.status.error, 0.1) }}
            />
          )}
        </>
      )}
      <Tooltip title="Refresh">
        <IconButton size="small" onClick={() => setRefreshKey(prev => prev + 1)} disabled={loading}>
          <Refresh fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <PageLayout title="Ingestions" totalRows={totalRows}>
      {!loading && ingestions.length === 0 && totalRows === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No ingestions found. Run an ingestion export from the Export page to populate this data.
        </Alert>
      )}

      <EnhancedAssetTable
        assets={ingestions}
        loading={loading}
        totalRows={totalRows}
        columns={columns}
        onFetchAssets={fetchIngestions}
        enableBulkActions={false}
        enableSourceTypeFiltering={true}
        availableSourceTypes={availableSourceTypes}
        defaultPageSize={50}
        defaultSortModel={[{ field: 'createdTime', sort: 'desc' }]}
        extraToolbarActions={extraToolbarActions}
        getRowId={(row) => `${row.datasetId}-${row.id}`}
        refreshKey={refreshKey}
      />
    </PageLayout>
  );
}
