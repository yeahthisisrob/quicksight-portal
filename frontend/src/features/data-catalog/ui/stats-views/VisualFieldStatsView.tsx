/**
 * Visual Field stats view for Data Catalog
 */
import { Grid } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { catalogIcons, assetIcons } from '@/shared/ui/icons';

import { StatCard } from '../components/StatCard';

import type { VisualFieldSummary } from '../../model/types';

interface VisualFieldStatsViewProps {
  visualFieldSummary: VisualFieldSummary;
}

export function VisualFieldStatsView({ visualFieldSummary }: VisualFieldStatsViewProps) {
  const FieldIcon = catalogIcons.physical;
  const DashboardIcon = assetIcons.DASHBOARD;
  const AnalysisIcon = assetIcons.ANALYSIS;
  const TableChartIcon = catalogIcons.visual;

  const statCards = [
    {
      title: "Total Fields",
      value: visualFieldSummary.totalFields || 0,
      icon: <FieldIcon sx={{ color: colors.primary.main, fontSize: 28 }} />,
      color: colors.primary.main,
    },
    {
      title: "In Dashboards",
      value: visualFieldSummary.mappingsByAssetType?.dashboards || 0,
      icon: <DashboardIcon sx={{ color: colors.assetTypes.dashboard.main, fontSize: 28 }} />,
      color: colors.assetTypes.dashboard.main,
    },
    {
      title: "In Analyses",
      value: visualFieldSummary.mappingsByAssetType?.analyses || 0,
      icon: <AnalysisIcon sx={{ color: colors.assetTypes.analysis.main, fontSize: 28 }} />,
      color: colors.assetTypes.analysis.main,
    },
    {
      title: "Visual Types",
      value: Object.keys(visualFieldSummary.mappingsByVisualType || {}).length,
      icon: <TableChartIcon sx={{ color: colors.primary.dark, fontSize: 28 }} />,
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