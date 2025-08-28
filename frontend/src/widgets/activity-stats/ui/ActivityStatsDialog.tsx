import { 
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Box, 
  Typography,
  Grid,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Skeleton,
  Alert,
  Tooltip
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';


import { activityApi } from '@/shared/api';
import { spacing, colors, typography } from '@/shared/design-system/theme';

import type { ActivityData } from '@/features/activity';

interface ActivityStatsDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: 'dashboard' | 'analysis';
  assetId: string;
}

export function ActivityStatsDialog({ 
  open, 
  onClose, 
  assetName, 
  assetType,
  assetId
}: ActivityStatsDialogProps) {
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activityApi.getActivityData(assetType, assetId);
      setActivity(data as ActivityData);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity data');
    } finally {
      setLoading(false);
    }
  }, [assetType, assetId]);

  useEffect(() => {
    if (open && assetId) {
      loadActivityData();
    }
  }, [open, assetId, loadActivityData]);

  if (!open) return null;

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Activity Statistics - {assetName}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ pt: spacing.sm / 8 }}>
          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.md / 8 }}>
              <Skeleton variant="rectangular" height={100} />
              <Skeleton variant="rectangular" height={200} />
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ my: spacing.md / 8 }}>
              {error}
            </Alert>
          )}
          {activity && (
            <>
              {/* Summary Stats */}
              <Grid container spacing={2} sx={{ mb: spacing.md / 8 }}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: spacing.md / 8, textAlign: 'center' }}>
                    <TrendingUpIcon color="primary" sx={{ fontSize: 40, mb: spacing.xs / 8 }} />
                    <Typography variant="h4">{activity.totalViews}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Views</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: spacing.md / 8, textAlign: 'center' }}>
                    <PeopleIcon color="primary" sx={{ fontSize: 40, mb: spacing.xs / 8 }} />
                    <Typography variant="h4">{activity.uniqueViewers}</Typography>
                    <Typography variant="body2" color="text.secondary">Unique Viewers</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: spacing.md / 8, textAlign: 'center' }}>
                    <AccessTimeIcon color="primary" sx={{ fontSize: 40, mb: spacing.xs / 8 }} />
                    <Typography variant="body1">{formatDate(activity.lastViewed)}</Typography>
                    <Typography variant="body2" color="text.secondary">Last Viewed</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Divider sx={{ my: spacing.md / 8 }} />

              {/* Top Viewers */}
              <Typography variant="h6" sx={{ mb: spacing.sm / 8 }}>
                Top Viewers
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '40%', minWidth: 250 }}>User</TableCell>
                      <TableCell sx={{ width: '20%', minWidth: 120 }}>Groups</TableCell>
                      <TableCell align="right" sx={{ width: '15%', minWidth: 80 }}>Views</TableCell>
                      <TableCell align="right" sx={{ width: '25%', minWidth: 180 }}>Last Viewed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activity.viewers.map((viewer, index) => (
                      <TableRow key={viewer.userName}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon fontSize="small" sx={{ color: colors.neutral[500] }} />
                            <Typography variant="body2" sx={{ fontWeight: typography.fontWeight.medium }}>
                              {viewer.userName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {viewer.groups && viewer.groups.length > 0 ? (
                            <Tooltip 
                              title={viewer.groups.join(', ')}
                              enterDelay={300}
                              leaveDelay={0}
                            >
                              <Chip 
                                label={viewer.groups.length === 1 ? viewer.groups[0] : `${viewer.groups[0]} +${viewer.groups.length - 1}`}
                                size="small" 
                                color="default"
                                sx={{ 
                                  cursor: 'pointer',
                                  '&:hover': { 
                                    backgroundColor: 'primary.main',
                                    color: 'primary.contrastText',
                                  }
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={viewer.viewCount} 
                            size="small" 
                            color={index === 0 ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {viewer.lastViewed ? formatDate(viewer.lastViewed) : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Views by Date Chart (simplified) */}
              {Object.keys(activity.viewsByDate).length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: spacing.md / 8, mb: spacing.sm / 8 }}>
                    Recent Activity
                  </Typography>
                  <Paper sx={{ p: spacing.md / 8 }}>
                    <Box sx={{ display: 'flex', gap: spacing.xs / 8, flexWrap: 'wrap' }}>
                      {Object.entries(activity.viewsByDate)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .slice(0, 7)
                        .map(([date, count]) => (
                          <Chip
                            key={date}
                            label={`${format(parseISO(date), 'MMM d')}: ${count} views`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                    </Box>
                  </Paper>
                </>
              )}
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}