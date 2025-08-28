/**
 * Physical stats view for Data Catalog
 */
import { Grid, Card, CardContent, Typography, Box, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';
import { catalogIcons, assetIcons, specialIcons } from '@/shared/ui/icons';

import { DataTypeBar } from '../components/DataTypeBar';
import { StatCard } from '../components/StatCard';

import type { DataCatalogSummary, DataType } from '../../model/types';

interface PhysicalStatsViewProps {
  catalogSummary: DataCatalogSummary;
}

const dataTypeColors: Record<DataType, string> = {
  STRING: colors.primary.main,
  INTEGER: colors.assetTypes.dataset.main,
  DECIMAL: colors.assetTypes.datasource.main,
  DATETIME: colors.assetTypes.analysis.main,
  BOOLEAN: colors.assetTypes.dashboard.main,
  Unknown: colors.neutral[500],
};

export function PhysicalStatsView({ catalogSummary }: PhysicalStatsViewProps) {
  const FieldIcon = catalogIcons.physical;
  const CalculatedIcon = catalogIcons.calculated;
  const TableChartIcon = catalogIcons.visual;
  const DatasetIcon = assetIcons.DATASET;
  const AnalysisIcon = assetIcons.ANALYSIS;
  const DataTypeIcon = specialIcons.storage;

  const totalFields = catalogSummary.totalFields || 0;
  const distinctFields = catalogSummary.distinctFields || 0;
  const fieldsByDataType = catalogSummary.fieldsByDataType || {};

  const statCards = [
    {
      title: "Total Fields",
      value: totalFields,
      icon: <FieldIcon sx={{ color: colors.primary.main, fontSize: 28 }} />,
      color: colors.primary.main,
    },
    {
      title: "Distinct Fields",
      value: distinctFields,
      icon: <FieldIcon sx={{ color: colors.primary.dark, fontSize: 28 }} />,
      color: colors.primary.dark,
      subtitle: totalFields > 0 ? `${((distinctFields / totalFields) * 100).toFixed(0)}% unique` : '',
    },
    {
      title: "Visual Fields",
      value: catalogSummary.visualFields || 0,
      icon: <TableChartIcon sx={{ color: colors.assetTypes.dashboard.main, fontSize: 28 }} />,
      color: colors.assetTypes.dashboard.main,
    },
    {
      title: "Total Calculated",
      value: catalogSummary.totalCalculatedFields || 0,
      icon: <CalculatedIcon sx={{ color: colors.assetTypes.datasource.main, fontSize: 28 }} />,
      color: colors.assetTypes.datasource.main,
    },
    {
      title: "Dataset Calculated",
      value: catalogSummary.calculatedDatasetFields || 0,
      icon: <DatasetIcon sx={{ color: colors.assetTypes.dataset.main, fontSize: 28 }} />,
      color: colors.assetTypes.dataset.main,
    },
    {
      title: "Analysis Calculated",
      value: catalogSummary.calculatedAnalysisFields || 0,
      icon: <AnalysisIcon sx={{ color: colors.assetTypes.analysis.main, fontSize: 28 }} />,
      color: colors.assetTypes.analysis.main,
    },
  ];

  return (
    <Box sx={{ mb: spacing.lg / 8 }}>
      <Grid container spacing={spacing.md / 8}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={2} key={index}>
            <StatCard {...card} />
          </Grid>
        ))}
      </Grid>

      {Object.keys(fieldsByDataType).length > 0 && (
        <Card 
          sx={{ 
            mt: spacing.md / 8,
            borderRadius: `${spacing.sm / 8}px`,
            border: `1px solid ${colors.neutral[200]}`,
            boxShadow: `0 1px 3px ${alpha(colors.neutral[900], 0.05)}`,
          }}
        >
          <CardContent sx={{ p: spacing.lg / 8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: spacing.md / 8 }}>
              <DataTypeIcon 
                sx={{ 
                  mr: spacing.sm / 8, 
                  color: colors.neutral[600],
                  fontSize: 24,
                }} 
              />
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 700,
                  color: colors.neutral[800],
                }}
              >
                Field Data Types Distribution
              </Typography>
            </Box>
            <Grid container spacing={spacing.lg / 8}>
              {Object.entries(fieldsByDataType)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([dataType, count]) => (
                  <Grid item xs={12} sm={6} md={4} key={dataType}>
                    <DataTypeBar
                      dataType={dataType}
                      count={count as number}
                      total={distinctFields}
                      color={dataTypeColors[dataType as DataType] || colors.neutral[600]}
                    />
                  </Grid>
                ))}
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}