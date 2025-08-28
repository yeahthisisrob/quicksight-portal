/**
 * Semantic stats view for Data Catalog
 */
import { Grid } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { catalogIcons, statusIcons } from '@/shared/ui/icons';

import { StatCard } from '../components/StatCard';

import type { SemanticStats } from '../../model/types';

interface SemanticStatsViewProps {
  stats: SemanticStats;
}

export function SemanticStatsView({ stats }: SemanticStatsViewProps) {
  const FieldIcon = catalogIcons.physical;
  const CheckCircleIcon = statusIcons.success;
  const WarningIcon = statusIcons.warning;
  const TrendingUpIcon = statusIcons.success;

  const statCards = [
    {
      title: "Total Terms",
      value: stats.totalTerms || 0,
      icon: <FieldIcon sx={{ color: colors.primary.main, fontSize: 28 }} />,
      color: colors.primary.main,
    },
    {
      title: "Mapped Fields",
      value: stats.mappedFields || 0,
      icon: <CheckCircleIcon sx={{ color: colors.assetTypes.dashboard.main, fontSize: 28 }} />,
      color: colors.assetTypes.dashboard.main,
    },
    {
      title: "Unmapped Fields",
      value: stats.unmappedFields || 0,
      icon: <WarningIcon sx={{ color: colors.assetTypes.datasource.main, fontSize: 28 }} />,
      color: colors.assetTypes.datasource.main,
    },
    {
      title: "Coverage",
      value: stats.coverage ? `${stats.coverage}%` : '0%',
      icon: <TrendingUpIcon sx={{ color: colors.primary.dark, fontSize: 28 }} />,
      color: colors.primary.dark,
    },
  ];

  return (
    <Grid container spacing={spacing.md / 8} sx={{ mb: spacing.lg / 8 }}>
      {statCards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <StatCard {...card} />
        </Grid>
      ))}
    </Grid>
  );
}