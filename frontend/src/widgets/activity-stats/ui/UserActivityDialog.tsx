import { 
  TrendingUp as TrendingUpIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarTodayIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon
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
  IconButton,
  alpha
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import { enqueueSnackbar } from 'notistack';
import { useState, useEffect, useCallback } from 'react';


import { activityApi } from '@/shared/api';
import { colors, borderRadius, typography } from '@/shared/design-system/theme';

import type { UserActivity } from '@/features/activity';

interface UserActivityDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
}

export function UserActivityDialog({ 
  open, 
  onClose, 
  userName,
  userId
}: UserActivityDialogProps) {
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activityApi.getActivityData('user', userId);
      setActivity(data as UserActivity);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      loadActivityData();
    }
  }, [open, userId, loadActivityData]);

  if (!open) return null;

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'info' });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ px: 3, py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: typography.fontWeight.semibold }}>
              User Activity
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {userName}
              </Typography>
              <Chip
                label="User"
                size="small"
                sx={{
                  backgroundColor: alpha(colors.assetTypes.user.main, 0.1),
                  color: colors.assetTypes.user.dark,
                  fontWeight: typography.fontWeight.medium,
                  fontSize: typography.fontSize.xs
                }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                ID: {userId.length > 20 ? `${userId.slice(0, 8)}...${userId.slice(-4)}` : userId}
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(userId)}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Box>
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{ ml: 1 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ px: 3, pb: 3 }}>
        <Box sx={{ pt: 1 }}>
          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: `${borderRadius.md}px` }} />
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: `${borderRadius.md}px` }} />
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ my: 2 }}>
              {error}
            </Alert>
          )}
          {activity && (
            <>
              {/* Summary Stats */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Paper 
                    variant="outlined"
                    sx={{ 
                      p: 2.5, 
                      textAlign: 'center',
                      border: `1px solid ${alpha(colors.primary.main, 0.2)}`,
                      backgroundColor: alpha(colors.primary.light, 0.05),
                      borderRadius: `${borderRadius.md}px`
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 36, color: colors.primary.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: typography.fontWeight.bold, color: colors.primary.dark }}>
                      {activity.totalActivities.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: typography.fontWeight.medium }}>
                      Total Activities
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper 
                    variant="outlined"
                    sx={{ 
                      p: 2.5, 
                      textAlign: 'center',
                      border: `1px solid ${alpha(colors.assetTypes.dashboard.main, 0.2)}`,
                      backgroundColor: alpha(colors.assetTypes.dashboard.light, 0.05),
                      borderRadius: `${borderRadius.md}px`
                    }}
                  >
                    <DashboardIcon sx={{ fontSize: 36, color: colors.assetTypes.dashboard.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: typography.fontWeight.bold, color: colors.assetTypes.dashboard.dark }}>
                      {(activity.dashboards?.length || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: typography.fontWeight.medium }}>
                      Dashboards Viewed
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper 
                    variant="outlined"
                    sx={{ 
                      p: 2.5, 
                      textAlign: 'center',
                      border: `1px solid ${alpha(colors.neutral[300], 0.5)}`,
                      backgroundColor: alpha(colors.neutral[100], 0.5),
                      borderRadius: `${borderRadius.md}px`
                    }}
                  >
                    <AccessTimeIcon sx={{ fontSize: 36, color: colors.neutral[600], mb: 1 }} />
                    <Typography variant="body1" sx={{ fontWeight: typography.fontWeight.medium }}>
                      {activity.lastActive ? formatDate(activity.lastActive) : 'Never'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: typography.fontWeight.medium }}>
                      Last Active
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Dashboard Activity */}
              {activity.dashboards && activity.dashboards.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: typography.fontWeight.semibold }}>
                    Dashboard Activity
                  </Typography>
                  <TableContainer 
                    component={Paper} 
                    variant="outlined"
                    sx={{ 
                      mb: 3,
                      borderRadius: `${borderRadius.md}px`,
                      overflow: 'hidden'
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Dashboard</TableCell>
                          <TableCell align="right">Views</TableCell>
                          <TableCell align="right">Last Viewed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activity.dashboards.map((dashboard) => (
                          <TableRow key={dashboard.dashboardId}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DashboardIcon fontSize="small" sx={{ color: colors.assetTypes.dashboard.main }} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: typography.fontWeight.medium }}>
                                    {dashboard.dashboardName || 'Unnamed Dashboard'}
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{ 
                                      fontFamily: typography.fontFamily.monospace,
                                      fontSize: typography.fontSize.xs 
                                    }}
                                  >
                                    {dashboard.dashboardId}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={dashboard.viewCount} 
                                size="small" 
                                color="primary"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                {dashboard.lastViewed ? formatDate(dashboard.lastViewed) : '-'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Analysis Activity */}
              {activity.analyses && activity.analyses.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: typography.fontWeight.semibold }}>
                    Analysis Activity
                  </Typography>
                  <TableContainer 
                    component={Paper} 
                    variant="outlined"
                    sx={{ 
                      borderRadius: `${borderRadius.md}px`,
                      overflow: 'hidden'
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Analysis</TableCell>
                          <TableCell align="right">Views</TableCell>
                          <TableCell align="right">Last Viewed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activity.analyses.map((analysis) => (
                          <TableRow key={analysis.analysisId}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AnalyticsIcon fontSize="small" sx={{ color: colors.assetTypes.analysis.main }} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: typography.fontWeight.medium }}>
                                    {analysis.analysisName || 'Unnamed Analysis'}
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    color="text.secondary"
                                    sx={{ 
                                      fontFamily: typography.fontFamily.monospace,
                                      fontSize: typography.fontSize.xs 
                                    }}
                                  >
                                    {analysis.analysisId}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={analysis.viewCount} 
                                size="small" 
                                color="primary"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                {analysis.lastViewed ? formatDate(analysis.lastViewed) : '-'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Activity by Date */}
              {Object.keys(activity.activitiesByDate || {}).length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 2, fontWeight: typography.fontWeight.semibold }}>
                    Recent Activity
                  </Typography>
                  <Paper 
                    variant="outlined"
                    sx={{ 
                      p: 2.5,
                      borderRadius: `${borderRadius.md}px`,
                      backgroundColor: alpha(colors.neutral[50], 0.5)
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {Object.entries(activity.activitiesByDate || {})
                        .sort(([a], [b]) => b.localeCompare(a))
                        .slice(0, 7)
                        .map(([date, count]) => (
                          <Chip
                            key={date}
                            icon={<CalendarTodayIcon />}
                            label={`${format(parseISO(date), 'MMM d')}: ${count} activities`}
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