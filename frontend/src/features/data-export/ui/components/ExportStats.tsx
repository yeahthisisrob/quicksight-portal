import { Storage, Functions, Schedule, Archive } from '@mui/icons-material';
import { Box, Card, Typography, Skeleton, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

interface StatItemProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}

function StatItem({ label, value, subtitle, icon: Icon, color, loading }: StatItemProps) {
  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: `${spacing.sm / 8}px`,
        border: `1px solid ${alpha(color, 0.15)}`,
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            p: 0.75,
            borderRadius: `${spacing.xs / 8}px`,
            bgcolor: alpha(color, 0.1),
            color,
            display: 'flex',
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {loading ? (
            <Skeleton variant="text" width={60} height={24} />
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color, lineHeight: 1.2 }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}{subtitle ? ` · ${subtitle}` : ''}
          </Typography>
        </Box>
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
  loading?: boolean;
}

function formatLastUpdated(dateString: string | null | undefined): { value: string; subtitle: string } {
  if (!dateString) return { value: 'Never', subtitle: 'Run initial export' };

  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return { value: 'Just now', subtitle: 'Current' };
  if (diffMins < 60) return { value: `${diffMins}m ago`, subtitle: 'Current' };
  if (diffHours < 24) return { value: `${diffHours}h ago`, subtitle: diffHours < 6 ? 'Current' : 'Consider refresh' };
  if (diffDays < 7) return { value: `${diffDays}d ago`, subtitle: 'May need refresh' };
  return { value: new Date(dateString).toLocaleDateString(), subtitle: 'Stale' };
}

export default function ExportStats({
  totalAssets,
  archivedAssets = 0,
  lastUpdated,
  fieldStats,
  loading = false,
}: ExportStatsProps) {
  const lastUpdatedInfo = formatLastUpdated(lastUpdated);

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <StatItem
        label="Total Assets"
        value={totalAssets}
        subtitle="Cached"
        icon={Storage}
        color={colors.primary.main}
        loading={loading}
      />
      <StatItem
        label="Last Updated"
        value={lastUpdatedInfo.value}
        subtitle={lastUpdatedInfo.subtitle}
        icon={Schedule}
        color={lastUpdatedInfo.value === 'Never' ? colors.neutral[500] : colors.primary.main}
        loading={loading}
      />
      <StatItem
        label="Fields"
        value={fieldStats?.total || 0}
        subtitle={fieldStats ? `${fieldStats.calculated} calc` : undefined}
        icon={Functions}
        color={colors.primary.dark}
        loading={loading}
      />
      <StatItem
        label="Archived"
        value={archivedAssets}
        icon={Archive}
        color={colors.status.warning}
        loading={loading}
      />
    </Box>
  );
}
