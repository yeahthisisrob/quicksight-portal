import { Storage, Functions, TrendingUp, Speed, Archive } from '@mui/icons-material';
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
  exportedAssets: number;
  archivedAssets?: number;
  fieldStats: {
    total: number;
    calculated: number;
    physical: number;
  } | null;
  cacheSize?: number;
  loading?: boolean;
}

export default function ExportStats({ 
  totalAssets, 
  exportedAssets, 
  archivedAssets = 0,
  fieldStats,
  loading = false 
}: ExportStatsProps) {
  
  const syncPercentage = totalAssets > 0 ? Math.round((exportedAssets / totalAssets) * 100) : 0;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Assets"
          value={totalAssets}
          subtitle={`${exportedAssets} synchronized`}
          icon={Storage}
          color={colors.primary.main}
          loading={loading}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Sync Status"
          value={totalAssets === 0 ? 'No Data' : `${syncPercentage}%`}
          subtitle={totalAssets === 0 ? 'Run initial export' : syncPercentage === 100 ? 'Fully synchronized' : 'Partial sync'}
          icon={Speed}
          color={totalAssets === 0 ? colors.neutral[500] : syncPercentage === 100 ? colors.status.success : colors.status.warning}
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