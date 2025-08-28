import {
  HistoryOutlined as HistoryIcon,
  DescriptionOutlined as LogsIcon,
  RefreshOutlined as RefreshIcon,
  CheckCircleOutline as SuccessIcon,
  ErrorOutline as ErrorIcon,
  PauseCircleOutline as StoppedIcon,
  HourglassEmpty as ProcessingIcon,
  Schedule as QueuedIcon,
} from '@mui/icons-material';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  Skeleton,
  Stack,
  useTheme,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { format, formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';

import { exportApi } from '@/shared/api';
import { colors, spacing } from '@/shared/design-system/theme';

interface Job {
  jobId: string;
  jobType?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';
  progress?: number;
  message?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  stats?: {
    totalAssets?: number;
    processedAssets?: number;
    failedAssets?: number;
    operations?: Record<string, number>;
  };
  error?: string;
}

interface JobHistoryProps {
  onSelectJob: (jobId: string) => void;
  currentJobId?: string | null;
}

export function JobHistory({ onSelectJob, currentJobId }: JobHistoryProps) {
  const theme = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadJobs = async () => {
    try {
      setLoading(true);
      const result = await exportApi.listJobs({
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter as any
      });
      setJobs(result?.jobs || []);
    } catch (error) {
      console.error('Failed to load job history:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />;
      case 'failed':
        return <ErrorIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />;
      case 'stopped':
      case 'stopping':
        return <StoppedIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />;
      case 'processing':
        return <ProcessingIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />;
      case 'queued':
        return <QueuedIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'stopped':
      case 'stopping':
        return 'warning';
      case 'processing':
        return 'info';
      case 'queued':
      default:
        return 'default';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '-';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Paper
      sx={{
        background: alpha(colors.primary.light, 0.02),
        border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
        borderRadius: `${spacing.sm / 8}px`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${alpha(colors.primary.main, 0.08)}`,
          background: alpha(colors.primary.light, 0.03),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <HistoryIcon sx={{ fontSize: 20, color: colors.primary.main }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Export History
          </Typography>
          <Chip
            label={`${jobs.length} jobs`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.75rem',
              backgroundColor: alpha(colors.primary.main, 0.1),
              color: colors.primary.main,
            }}
          />
        </Box>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
              sx={{ height: 36 }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="stopped">Stopped</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="queued">Queued</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title="Refresh">
            <IconButton
              onClick={refresh}
              disabled={refreshing}
              sx={{
                color: colors.primary.main,
                '&:hover': {
                  backgroundColor: alpha(colors.primary.main, 0.08),
                },
              }}
            >
              <RefreshIcon sx={{ 
                fontSize: 20,
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: theme.palette.background.paper }}>
                Status
              </TableCell>
              <TableCell sx={{ backgroundColor: theme.palette.background.paper }}>
                Started
              </TableCell>
              <TableCell sx={{ backgroundColor: theme.palette.background.paper }}>
                Duration
              </TableCell>
              <TableCell sx={{ backgroundColor: theme.palette.background.paper }}>
                Assets
              </TableCell>
              <TableCell sx={{ backgroundColor: theme.palette.background.paper }}>
                API Calls
              </TableCell>
              <TableCell sx={{ backgroundColor: theme.palette.background.paper }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No export jobs found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow
                  key={job.jobId}
                  hover
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: job.jobId === currentJobId 
                      ? alpha(colors.primary.main, 0.08) 
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: alpha(colors.primary.main, 0.04),
                    },
                  }}
                  onClick={() => onSelectJob(job.jobId)}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(job.status)}
                      <Chip
                        label={job.status}
                        size="small"
                        color={getStatusColor(job.status) as any}
                        sx={{ height: 22, fontSize: '0.7rem' }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={format(new Date(job.startTime), 'PPpp')}>
                      <Typography variant="caption">
                        {formatDistanceToNow(new Date(job.startTime), { addSuffix: true })}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDuration(job.duration)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {job.stats?.processedAssets || 0} / {job.stats?.totalAssets || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {(() => {
                        const ops = job.stats?.operations || {};
                        // Sum up all API operations (list, describe, definition, permissions, tags)
                        const apiCalls = Object.entries(ops)
                          .reduce((sum, [, value]) => sum + value, 0);
                        return apiCalls || 0;
                      })()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View logs">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectJob(job.jobId);
                        }}
                        sx={{
                          color: colors.primary.main,
                          '&:hover': {
                            backgroundColor: alpha(colors.primary.main, 0.08),
                          },
                        }}
                      >
                        <LogsIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}