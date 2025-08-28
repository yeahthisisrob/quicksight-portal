import { 
  Dashboard, 
  Dataset, 
  Analytics, 
  Source, 
  Folder, 
  Person, 
  Group,
  CheckCircle,
  RadioButtonUnchecked 
} from '@mui/icons-material';
import { Box, Card, Grid, Typography, Stack, Chip, alpha } from '@mui/material';

import { colors, spacing } from '@/shared/design-system/theme';

import { AssetType } from '../../model/types';
import { assetTypeConfig } from '../constants';

// Map icons to the asset types
const assetTypeIcons = {
  dashboards: Dashboard,
  datasets: Dataset,
  analyses: Analytics,
  datasources: Source,
  folders: Folder,
  users: Person,
  groups: Group,
  themes: Analytics, // Using Analytics as placeholder for themes
  templates: Dashboard, // Using Dashboard as placeholder for templates
  refreshSchedules: Source, // Using Source as placeholder for refreshSchedules
  vpcConnections: Source, // Using Source as placeholder for vpcConnections
  namespaces: Folder, // Using Folder as placeholder for namespaces
} as const;

interface AssetTypeSelectorProps {
  selectedTypes: AssetType[];
  onToggle: (assetType: AssetType) => void;
  counts?: Record<AssetType, number>;
  disabled?: boolean;
}

export default function AssetTypeSelector({ 
  selectedTypes, 
  onToggle, 
  counts,
  disabled = false 
}: AssetTypeSelectorProps) {

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: spacing.sm / 8 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Asset Types
        </Typography>
        <Chip 
          label={`${selectedTypes.length} selected`} 
          size="small" 
          color={selectedTypes.length > 0 ? "primary" : "default"}
        />
      </Stack>

      <Grid container spacing={2}>
        {Object.entries(assetTypeConfig).map(([assetType, config]) => {
          const isSelected = selectedTypes.includes(assetType as AssetType);
          const count = counts?.[assetType as AssetType] || 0;
          const Icon = assetTypeIcons[assetType as keyof typeof assetTypeIcons];

          const isAssetDisabled = disabled || (config as any).disabled;
          
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={assetType}>
              <Card
                sx={{
                  height: '100%',
                  cursor: isAssetDisabled ? 'not-allowed' : 'pointer',
                  border: `2px solid ${isSelected && !isAssetDisabled ? config.color : 'transparent'}`,
                  background: isSelected && !isAssetDisabled
                    ? `linear-gradient(135deg, ${alpha(config.color, 0.05)} 0%, ${alpha(config.color, 0.1)} 100%)`
                    : 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': !isAssetDisabled ? {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${alpha(config.color, 0.2)}`,
                    borderColor: alpha(config.color, 0.3),
                  } : {},
                  opacity: isAssetDisabled ? 0.5 : 1,
                  filter: isAssetDisabled ? 'grayscale(40%)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={() => !isAssetDisabled && onToggle(assetType as AssetType)}
              >
                <Box sx={{ p: spacing.md / 8, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box
                      sx={{
                        p: spacing.xs / 8,
                        borderRadius: `${spacing.xs / 8}px`,
                        background: alpha(config.color, 0.1),
                        color: config.color,
                      }}
                    >
                      {Icon && <Icon sx={{ fontSize: 24 }} />}
                    </Box>
                    {isAssetDisabled ? (
                      <RadioButtonUnchecked sx={{ color: colors.neutral[300], fontSize: 20 }} />
                    ) : isSelected ? (
                      <CheckCircle sx={{ color: config.color, fontSize: 20 }} />
                    ) : (
                      <RadioButtonUnchecked sx={{ color: colors.neutral[400], fontSize: 20 }} />
                    )}
                  </Stack>

                  <Box sx={{ mt: spacing.sm / 8, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {config.label}
                      </Typography>
                      {(config as any).comingSoon && (
                        <Chip 
                          label="Coming Soon" 
                          size="small" 
                          variant="outlined"
                          sx={{ 
                            fontSize: '0.65rem',
                            height: '18px',
                            color: colors.neutral[500],
                            borderColor: colors.neutral[300],
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', flexGrow: 1 }}>
                      {config.description}
                    </Typography>
                    {count > 0 && !isAssetDisabled && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          mt: 'auto',
                          pt: spacing.xs / 8,
                          color: config.color,
                          fontWeight: 600 
                        }}
                      >
                        {count.toLocaleString()} items
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}