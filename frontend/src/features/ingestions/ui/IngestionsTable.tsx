import {
  MoreVert,
  Cancel,
  Info,
  Refresh,
  Search,
  DataUsage,
  AccessTime,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  CloudQueue,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Box,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TableSortLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  alpha,
} from '@mui/material';
import { format } from 'date-fns';
import { useState } from 'react';

import { DatasourceTypeBadge } from '@/entities/field';

import { colors, spacing } from '@/shared/design-system/theme';

import type { components } from '@shared/generated/types';
// Remove TablePagination import - will implement inline

type Ingestion = components['schemas']['Ingestion'];
type IngestionMetadata = components['schemas']['IngestionListResponse']['data']['metadata'];
type PaginationData = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
};

interface IngestionsTableProps {
  ingestions: Ingestion[];
  metadata: IngestionMetadata;
  pagination: PaginationData;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onCancelIngestion: (datasetId: string, ingestionId: string) => void;
  onViewDetails: (datasetId: string, ingestionId: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchValue: string;
}

const statusConfig = {
  RUNNING: { label: 'Running', color: colors.status.info, icon: HourglassEmpty },
  COMPLETED: { label: 'Completed', color: colors.status.success, icon: CheckCircle },
  FAILED: { label: 'Failed', color: colors.status.error, icon: ErrorIcon },
  CANCELLED: { label: 'Cancelled', color: colors.neutral[500], icon: Cancel },
  INITIALIZED: { label: 'Initialized', color: colors.neutral[400], icon: CloudQueue },
  QUEUED: { label: 'Queued', color: colors.status.warning, icon: CloudQueue },
};

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '-';
  return num.toLocaleString();
}

export function IngestionsTable({
  ingestions,
  metadata,
  pagination,
  loading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onSearchChange,
  onRefresh,
  onCancelIngestion,
  onViewDetails,
  sortBy,
  sortOrder,
  searchValue,
}: IngestionsTableProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedIngestion, setSelectedIngestion] = useState<Ingestion | null>(null);
  const [searchInput, setSearchInput] = useState(searchValue);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, ingestion: Ingestion) => {
    setAnchorEl(event.currentTarget);
    setSelectedIngestion(ingestion);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIngestion(null);
  };

  const handleSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    onSortChange(field, isAsc ? 'desc' : 'asc');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchInput);
  };

  const sortableColumns = [
    { field: 'datasetName', label: 'Dataset' },
    { field: 'status', label: 'Status' },
    { field: 'createdTime', label: 'Started' },
    { field: 'ingestionTimeInSeconds', label: 'Duration' },
    { field: 'rowsIngested', label: 'Rows' },
  ];

  return (
    <Box>
      {/* Search and Stats Bar */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <form onSubmit={handleSearchSubmit}>
            <TextField
              placeholder="Search ingestions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: colors.neutral[400] }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: `${spacing.sm / 8}px`,
                },
              }}
            />
          </form>
        </Box>
        
        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            icon={<DataUsage />}
            label={`Total: ${formatNumber(metadata.totalIngestions)}`}
            size="small"
            sx={{ backgroundColor: alpha(colors.primary.main, 0.1) }}
          />
          {metadata.runningIngestions > 0 && (
            <Chip
              icon={<HourglassEmpty />}
              label={`Running: ${formatNumber(metadata.runningIngestions)}`}
              size="small"
              sx={{ backgroundColor: alpha(colors.status.info, 0.1) }}
            />
          )}
          {metadata.failedIngestions > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`Failed: ${formatNumber(metadata.failedIngestions)}`}
              size="small"
              sx={{ backgroundColor: alpha(colors.status.error, 0.1) }}
            />
          )}
        </Box>
        
        {/* Refresh Button */}
        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Last Updated Info */}
      {metadata.lastUpdated && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <AccessTime sx={{ fontSize: 16, color: colors.neutral[500] }} />
            <Typography variant="caption" color="text.secondary">
              Last updated: {format(new Date(metadata.lastUpdated), 'PPpp')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 3 }}>
            To get the latest ingestion status, use "Export Ingestions" on the Data Export page
          </Typography>
        </Box>
      )}

      {/* Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: `${spacing.sm / 8}px`,
          border: `1px solid ${colors.neutral[200]}`,
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: colors.neutral[50] }}>
              {sortableColumns.map((column) => (
                <TableCell key={column.field}>
                  <TableSortLabel
                    active={sortBy === column.field}
                    direction={sortBy === column.field ? sortOrder : 'asc'}
                    onClick={() => handleSort(column.field)}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell>Datasource Type</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : ingestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    No ingestions found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              ingestions.map((ingestion) => {
                const statusInfo = statusConfig[ingestion.status];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <TableRow 
                    key={ingestion.id}
                    sx={{ 
                      '& td': { py: 1 },
                      '&:hover': { backgroundColor: alpha(colors.primary.main, 0.02) },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {ingestion.datasetName || ingestion.datasetId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<StatusIcon sx={{ fontSize: 16 }} />}
                        label={statusInfo.label}
                        size="small"
                        sx={{
                          backgroundColor: alpha(statusInfo.color, 0.1),
                          color: statusInfo.color,
                          '& .MuiChip-icon': {
                            color: statusInfo.color,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(ingestion.createdTime), 'MMM d, yyyy HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDuration(ingestion.ingestionTimeInSeconds)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatNumber(ingestion.rowsIngested)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {ingestion.datasourceType ? (
                        <DatasourceTypeBadge 
                          datasourceType={ingestion.datasourceType}
                          importMode="SPICE"
                          compact
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, ingestion)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} items
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Page size:</Typography>
            <TextField
              select
              size="small"
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              SelectProps={{
                native: true,
              }}
              sx={{ minWidth: 80 }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </TextField>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            <ChevronLeft />
          </IconButton>
          
          <Typography variant="body2">
            Page {pagination.page} of {pagination.totalPages}
          </Typography>
          
          <IconButton
            size="small"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages || !pagination.hasMore}
          >
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: `${spacing.sm / 8}px`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          },
        }}
      >
        <MenuItem 
          onClick={() => {
            if (selectedIngestion) {
              onViewDetails(selectedIngestion.datasetId, selectedIngestion.id);
              handleMenuClose();
            }
          }}
        >
          <ListItemIcon>
            <Info fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        
        {selectedIngestion && ['RUNNING', 'QUEUED', 'INITIALIZED'].includes(selectedIngestion.status) && (
          <MenuItem 
            onClick={() => {
              if (selectedIngestion) {
                onCancelIngestion(selectedIngestion.datasetId, selectedIngestion.id);
                handleMenuClose();
              }
            }}
            sx={{ 
              color: colors.status.error,
              '& .MuiListItemIcon-root': { color: colors.status.error }
            }}
          >
            <ListItemIcon>
              <Cancel fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Cancel Ingestion" secondary="Stop this running ingestion" />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}