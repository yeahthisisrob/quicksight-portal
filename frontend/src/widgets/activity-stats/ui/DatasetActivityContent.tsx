import {
  AccessTime as AccessTimeIcon,
  Autorenew as AutorenewIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

import { AssetTypeBadge } from '@/entities/asset';
import { formatDuration, IngestionStatusChip } from '@/entities/ingestion';

import { spacing } from '@/shared/design-system/theme';

import type { DatasetActivityData } from '@/shared/api/modules/activity';

interface DatasetActivityContentProps {
  activity: DatasetActivityData;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
  } catch {
    return dateString;
  }
};

const formatRelative = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return null;
  }
};

function SummaryTile({
  icon,
  primary,
  label,
  secondary,
}: {
  icon: React.ReactNode;
  primary: React.ReactNode;
  label: string;
  secondary?: React.ReactNode;
}) {
  return (
    <Paper sx={{ p: spacing.md / 8, textAlign: 'center', height: '100%' }}>
      {icon}
      <Typography variant="h5" component="div">
        {primary}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {secondary}
    </Paper>
  );
}

/**
 * Dataset activity: summary tiles, refresh (ingestion) history, and the
 * view/update activity of dashboards & analyses that use the dataset.
 * Presentational — data comes from GET /activity/dataset/{id}.
 */
export function DatasetActivityContent({ activity }: DatasetActivityContentProps) {
  const { refreshSummary, ingestions, usedBy, viewsByDate } = activity;
  const iconSx = { fontSize: 40, mb: spacing.xs / 8 };
  const lastRefreshRelative = formatRelative(refreshSummary.lastIngestionTime);

  return (
    <>
      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: spacing.md / 8 }}>
        <Grid item xs={12} sm={3}>
          <SummaryTile
            icon={<TrendingUpIcon color="primary" sx={iconSx} />}
            primary={activity.totalViews.toLocaleString()}
            label="Views (via usage)"
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <SummaryTile
            icon={<PeopleIcon color="primary" sx={iconSx} />}
            primary={activity.uniqueViewers.toLocaleString()}
            label="Unique Viewers"
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <SummaryTile
            icon={<AccessTimeIcon color="primary" sx={iconSx} />}
            primary={
              <Typography variant="body1" component="span">
                {formatDate(activity.lastViewed)}
              </Typography>
            }
            label="Last Viewed"
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <SummaryTile
            icon={<AutorenewIcon color="primary" sx={iconSx} />}
            primary={
              <Typography variant="body1" component="span">
                {lastRefreshRelative || '-'}
              </Typography>
            }
            label="Last Refresh"
            secondary={
              refreshSummary.lastIngestionStatus ? (
                <Box sx={{ mt: spacing.xs / 8 }}>
                  <IngestionStatusChip status={refreshSummary.lastIngestionStatus} />
                </Box>
              ) : undefined
            }
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: spacing.md / 8 }} />

      {/* Refresh Activity (Ingestions) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: spacing.sm / 8 }}>
        <Typography variant="h6">Refresh Activity</Typography>
        {refreshSummary.totalIngestions > 0 && (
          <Chip label={`${refreshSummary.totalIngestions} runs`} size="small" variant="outlined" />
        )}
        {refreshSummary.failedIngestions > 0 && (
          <Chip
            label={`${refreshSummary.failedIngestions} failed`}
            size="small"
            color="error"
            variant="outlined"
          />
        )}
      </Box>
      {ingestions.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.md / 8 }}>
          No refresh history. Direct Query datasets have no ingestions; for SPICE datasets, run an
          activity refresh to populate this data.
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ mb: spacing.md / 8 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 130 }}>Status</TableCell>
                <TableCell sx={{ minWidth: 160 }}>Started</TableCell>
                <TableCell align="right" sx={{ minWidth: 90 }}>Duration</TableCell>
                <TableCell align="right" sx={{ minWidth: 100 }}>Rows</TableCell>
                <TableCell sx={{ minWidth: 130 }}>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ingestions.map((ingestion) => (
                <TableRow key={ingestion.id}>
                  <TableCell>
                    <IngestionStatusChip status={ingestion.status} />
                  </TableCell>
                  <TableCell>{formatDate(ingestion.createdTime)}</TableCell>
                  <TableCell align="right">
                    {formatDuration(ingestion.ingestionTimeInSeconds)}
                  </TableCell>
                  <TableCell align="right">
                    {ingestion.rowsIngested != null ? ingestion.rowsIngested.toLocaleString() : '-'}
                    {ingestion.rowsDropped ? ` (${ingestion.rowsDropped} dropped)` : ''}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {ingestion.requestType?.replace(/_/g, ' ').toLowerCase() || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Used By */}
      <Typography variant="h6" sx={{ mb: spacing.sm / 8 }}>
        Used By
      </Typography>
      {usedBy.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: spacing.md / 8 }}>
          Not used by any dashboards or analyses.
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '35%', minWidth: 220 }}>Asset</TableCell>
                <TableCell sx={{ minWidth: 110 }}>Type</TableCell>
                <TableCell align="right" sx={{ minWidth: 70 }}>Views</TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>Viewers</TableCell>
                <TableCell align="right" sx={{ minWidth: 160 }}>Last Viewed</TableCell>
                <TableCell align="right" sx={{ minWidth: 160 }}>Last Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usedBy.map((dependent, index) => (
                <TableRow key={`${dependent.assetType}:${dependent.assetId}`}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {dependent.assetName || dependent.assetId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <AssetTypeBadge type={dependent.assetType} />
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={dependent.totalViews}
                      size="small"
                      color={index === 0 && dependent.totalViews > 0 ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">{dependent.uniqueViewers}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(dependent.lastViewed)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(dependent.lastUpdated)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Recent Activity */}
      {Object.keys(viewsByDate).length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: spacing.md / 8, mb: spacing.sm / 8 }}>
            Recent Activity
          </Typography>
          <Paper sx={{ p: spacing.md / 8 }}>
            <Box sx={{ display: 'flex', gap: spacing.xs / 8, flexWrap: 'wrap' }}>
              {Object.entries(viewsByDate)
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
  );
}
