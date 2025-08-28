import { ExpandMore, ExpandLess, CheckCircle, Error, HourglassEmpty } from '@mui/icons-material';
import { Box, Card, Grid, Typography, LinearProgress, Stack, Collapse, IconButton, Chip, alpha } from '@mui/material';
import { useState } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

import { AssetTypeProgressState } from '../../model/types';
import { assetTypeConfig } from '../constants';

interface AssetTypeProgressCardProps {
  assetType: string;
  progress: AssetTypeProgressState;
}

function AssetTypeProgressCard({ assetType, progress }: AssetTypeProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const config = assetTypeConfig[assetType as keyof typeof assetTypeConfig];
  if (!config) return null;

  const progressPercentage = progress.total > 0 
    ? ((progress.enriched || 0) / progress.total) * 100 
    : 0;

  const getPhaseColor = () => {
    switch (progress.phase) {
      case 'completed': return colors.status.success;
      case 'error': return colors.status.error;
      case 'listing': return colors.status.info;
      case 'enriching': return colors.primary.main;
      default: return colors.neutral[400];
    }
  };

  const getPhaseIcon = () => {
    switch (progress.phase) {
      case 'completed': return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'error': return <Error sx={{ fontSize: 16 }} />;
      default: return <HourglassEmpty sx={{ fontSize: 16 }} />;
    }
  };

  return (
    <Card sx={{ 
      borderRadius: `${spacing.sm / 8}px`,
      border: `1px solid ${alpha(config.color, 0.2)}`,
      transition: 'all 0.2s ease',
      '&:hover': {
        boxShadow: `0 2px 8px ${alpha(config.color, 0.15)}`,
      },
    }}>
      <Box sx={{ p: spacing.sm / 8 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={spacing.sm / 8}>
            <Box
              sx={{
                p: spacing.xs / 8,
                borderRadius: `${spacing.xs / 8}px`,
                background: alpha(config.color, 0.1),
                color: config.color,
              }}
            >
              <config.icon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {config.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {progress.enriched || 0} / {progress.total} processed
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
            <Chip
              label={progress.phase}
              size="small"
              icon={getPhaseIcon()}
              sx={{
                backgroundColor: alpha(getPhaseColor(), 0.1),
                color: getPhaseColor(),
                '& .MuiChip-icon': {
                  color: getPhaseColor(),
                },
              }}
            />
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Stack>
        </Stack>

        <Box sx={{ mt: spacing.sm / 8 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercentage}
            sx={{
              height: 6,
              borderRadius: spacing.xs / 8,
              backgroundColor: alpha(config.color, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: getPhaseColor(),
                borderRadius: spacing.xs / 8,
              },
            }}
          />
          {progress.currentBatch && progress.totalBatches && progress.phase === 'enriching' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Batch {progress.currentBatch} of {progress.totalBatches}
            </Typography>
          )}
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ 
            mt: spacing.sm / 8, 
            p: spacing.sm / 8, 
            borderRadius: `${spacing.xs / 8}px`,
            backgroundColor: alpha(config.color, 0.03),
          }}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Listed</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {progress.listed || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Need Processing</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {progress.needsEnrichment || 0}
                </Typography>
              </Grid>
              {progress.failed && progress.failed > 0 && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="error">Failed</Typography>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                    {progress.failed}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </Collapse>
      </Box>
    </Card>
  );
}

interface AssetTypeProgressProps {
  assetTypes: Record<string, AssetTypeProgressState>;
}

export default function AssetTypeProgress({ assetTypes }: AssetTypeProgressProps) {

  if (Object.keys(assetTypes).length === 0) return null;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: spacing.sm / 8 }}>
        Asset Type Progress
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(assetTypes).map(([assetType, progress]) => (
          <Grid item xs={12} md={6} key={assetType}>
            <AssetTypeProgressCard assetType={assetType} progress={progress} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}