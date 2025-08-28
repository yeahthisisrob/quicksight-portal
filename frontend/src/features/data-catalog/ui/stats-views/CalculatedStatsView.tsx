/**
 * Calculated fields stats view for Data Catalog
 */
import { Grid } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { catalogIcons, statusIcons, actionIcons } from '@/shared/ui/icons';

import { StatCard } from '../components/StatCard';

import type { DataCatalogSummary } from '../../model/types';

interface CalculatedStatsViewProps {
  catalogSummary: DataCatalogSummary;
}

export function CalculatedStatsView({ catalogSummary }: CalculatedStatsViewProps) {
  const CalculatedIcon = catalogIcons.calculated;
  const CodeIcon = actionIcons.json;
  const WarningIcon = statusIcons.warning;

  const calculatedFields = catalogSummary.totalCalculatedFields || 0;
  const fieldsWithVariants = catalogSummary.fieldsWithVariants || 0;
  const fieldsWithComments = catalogSummary.fieldsWithComments || 0;

  const statCards = [
    {
      title: "Calculated Fields",
      value: calculatedFields,
      icon: <CalculatedIcon sx={{ color: colors.primary.main, fontSize: 28 }} />,
      color: colors.primary.main,
    },
    {
      title: "With Comments",
      value: fieldsWithComments,
      icon: <CodeIcon sx={{ color: colors.assetTypes.dashboard.main, fontSize: 28 }} />,
      color: colors.assetTypes.dashboard.main,
    },
    {
      title: "With Variants",
      value: fieldsWithVariants,
      icon: <WarningIcon sx={{ color: colors.assetTypes.datasource.main, fontSize: 28 }} />,
      color: colors.assetTypes.datasource.main,
    },
    {
      title: "Avg Length",
      value: catalogSummary.avgExpressionLength || 0,
      icon: <CalculatedIcon sx={{ color: colors.primary.dark, fontSize: 28 }} />,
      color: colors.primary.dark,
      subtitle: "characters",
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