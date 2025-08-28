import {
  Close as CloseIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  TableSortLabel,
} from '@mui/material';
import { format } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';

interface ViewStatsDialogProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;  // Works for both dashboards and analyses
  dashboardName: string;  // Works for both dashboards and analyses
  viewStats?: {
    totalViews: number;
    uniqueViewers: number;
    lastViewedAt?: string;
    statsRefreshedAt?: string;
    viewers?: DashboardViewer[];
  } | null;
}

interface DashboardViewer {
  userArn: string;
  userName: string;
  viewCount: number;
  lastViewedAt: string;
}

export default function ViewStatsDialog({
  open,
  onClose,
  dashboardName,
  viewStats: passedViewStats,
}: ViewStatsDialogProps) {
  const [viewStats, setViewStats] = useState<{
    totalViews: number;
    uniqueViewers: number;
    lastViewedAt?: string;
    statsRefreshedAt?: string;
    viewers?: DashboardViewer[];
  } | null>(passedViewStats || null);
  const [sortBy, setSortBy] = useState<'userName' | 'viewCount' | 'lastViewedAt'>('viewCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Update viewStats when passedViewStats changes
  useEffect(() => {
    if (passedViewStats) {
      setViewStats(passedViewStats);
    }
  }, [passedViewStats]);

  // Sort viewers based on current sort criteria
  const sortedViewers = useMemo(() => {
    if (!viewStats?.viewers) return [];
    
    return [...viewStats.viewers].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortBy) {
        case 'userName':
          aValue = a.userName.toLowerCase();
          bValue = b.userName.toLowerCase();
          break;
        case 'viewCount':
          aValue = a.viewCount;
          bValue = b.viewCount;
          break;
        case 'lastViewedAt':
          aValue = new Date(a.lastViewedAt).getTime();
          bValue = new Date(b.lastViewedAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [viewStats?.viewers, sortBy, sortOrder]);

  const handleSort = (field: 'userName' | 'viewCount' | 'lastViewedAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'viewCount' ? 'desc' : 'asc'); // Default to desc for view count, asc for others
    }
  };


  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays < 7) return `${diffDays} days ago`;
      return formatDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewIcon />
            <Typography variant="h6">View Statistics - Last 90 Days</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {dashboardName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {viewStats && viewStats.totalViews >= 0 ? (
          <Box>
            {/* Summary Stats */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
              <Paper sx={{ p: 2, flex: 1 }}>
                <Typography variant="h4" color="primary">
                  {viewStats.totalViews.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Views
                </Typography>
              </Paper>
              <Paper sx={{ p: 2, flex: 1 }}>
                <Typography variant="h4" color="secondary">
                  {viewStats.uniqueViewers.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Unique Viewers
                </Typography>
              </Paper>
              {viewStats.lastViewedAt && (
                <Paper sx={{ p: 2, flex: 1 }}>
                  <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimeIcon fontSize="small" />
                    {formatRelativeTime(viewStats.lastViewedAt)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last Viewed
                  </Typography>
                </Paper>
              )}
            </Box>

            {/* Stats Refresh Time */}
            {viewStats.statsRefreshedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Statistics last refreshed: {formatDate(viewStats.statsRefreshedAt)}
              </Typography>
            )}

            {/* Viewers Table */}
            {viewStats.viewers && viewStats.viewers.length > 0 ? (
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'userName'}
                          direction={sortBy === 'userName' ? sortOrder : 'asc'}
                          onClick={() => handleSort('userName')}
                        >
                          User
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center">
                        <TableSortLabel
                          active={sortBy === 'viewCount'}
                          direction={sortBy === 'viewCount' ? sortOrder : 'desc'}
                          onClick={() => handleSort('viewCount')}
                        >
                          Views
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'lastViewedAt'}
                          direction={sortBy === 'lastViewedAt' ? sortOrder : 'desc'}
                          onClick={() => handleSort('lastViewedAt')}
                        >
                          Last Viewed
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedViewers.map((viewer) => (
                      <TableRow
                        key={viewer.userArn}
                        sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon fontSize="small" color="action" />
                            <Box>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {viewer.userArn.split('/').pop()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {viewer.userName}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={viewer.viewCount} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatRelativeTime(viewer.lastViewedAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                {viewStats.totalViews > 0 
                  ? "Individual viewer details are not available. Only aggregate statistics are stored."
                  : "No views recorded in the last 90 days"}
              </Alert>
            )}
          </Box>
        ) : (
          <Alert severity="info">
            No view statistics available. Try refreshing view stats from the dashboard page or export process.
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}