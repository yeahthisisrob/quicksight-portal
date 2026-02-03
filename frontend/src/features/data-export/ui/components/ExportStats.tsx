import { Storage, Functions, TrendingUp, Schedule, Archive } from '@mui/icons-material';
import { Box, Card, Grid, Typography, Stack, alpha, Skeleton } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: {
    value: number;
    label: string;
  };
  loading?: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, loading }: StatCardProps) {

  return (
    <Card 
      sx={{ 
        height: '100%',
        borderRadius: `${spacing.sm / 8}px`,
        border: `1px solid ${alpha(color, 0.1)}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3),
        },
      }}
    >
      <Box sx={{ p: spacing.md / 8 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: spacing.sm / 8 }}>
          <Box
            sx={{
              p: spacing.xs / 8,
              borderRadius: `${spacing.xs / 8}px`,
              background: alpha(color, 0.1),
              color: color,
            }}
          >
            <Icon sx={{ fontSize: 24 }} />
          </Box>
          {trend && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <TrendingUp sx={{ fontSize: 16, color: trend.value > 0 ? 'success.main' : 'error.main' }} />
              <Typography variant="caption" color={trend.value > 0 ? 'success.main' : 'error.main'}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </Typography>
            </Stack>
          )}
        </Stack>

        {loading ? (
          <>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="80%" />
          </>
        ) : (
          <>
            <Typography variant="h5" sx={{ fontWeight: 600, color: color, mb: 0.5 }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Card>
  );
}

interface ExportStatsProps {
  totalAssets: number;
  archivedAssets?: number;
  lastUpdated?: string | null;
  fieldStats: {
    total: number;
    calculated: number;
    physical: number;
  } | null;
  cacheSize?: number;
  loading?: boolean;
}

/**
 * Format a date string for display
 */
function formatLastUpdated(dateString: string | null | undefined): { value: string; subtitle: string } {
  if (!dateString) {
    return { value: 'Never', subtitle: 'Run initial export' };
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let value: string;
  let subtitle: string;

  if (diffMins < 1) {
    value = 'Just now';
    subtitle = 'Cache is current';
  } else if (diffMins < 60) {
    value = `${diffMins}m ago`;
    subtitle = 'Cache is current';
  } else if (diffHours < 24) {
    value = `${diffHours}h ago`;
    subtitle = diffHours < 6 ? 'Cache is current' : 'Consider refreshing';
  } else if (diffDays < 7) {
    value = `${diffDays}d ago`;
    subtitle = 'May need refresh';
  } else {
    value = date.toLocaleDateString();
    subtitle = 'Cache is stale';
  }

  return { value, subtitle };
}

export default function ExportStats({
  totalAssets,
  archivedAssets = 0,
  lastUpdated,
  fieldStats,
  loading = false
}: ExportStatsProps) {

  const lastUpdatedInfo = formatLastUpdated(lastUpdated);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Assets"
          value={totalAssets}
          subtitle="Cached in portal"
          icon={Storage}
          color={colors.primary.main}
          loading={loading}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Last Updated"
          value={lastUpdatedInfo.value}
          subtitle={lastUpdatedInfo.subtitle}
          icon={Schedule}
          color={lastUpdatedInfo.value === 'Never' ? colors.neutral[500] : lastUpdatedInfo.subtitle === 'Cache is current' ? colors.status.success : colors.status.warning}
          loading={loading}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Field Catalog"
          value={fieldStats?.total || 0}
          subtitle={fieldStats ? `${fieldStats.calculated} calculated, ${fieldStats.physical} physical` : 'No data'}
          icon={Functions}
          color={colors.primary.dark}
          loading={loading}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Archived Assets"
          value={archivedAssets}
          subtitle={archivedAssets > 0 ? 'Deleted from QuickSight' : 'No archived assets'}
          icon={Archive}
          color={colors.status.warning}
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}