import { OpenInNew as OpenInNewIcon , 
  Dashboard as DashboardIcon,
  Analytics as AnalysisIcon,
  Storage as DatasetIcon,
  CloudQueue as DatasourceIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { Box, Paper, Typography, alpha, Tooltip, Chip } from '@mui/material';

import { colors, spacing, borderRadius, typography } from '@/shared/design-system/theme';
import TypedChip from '@/shared/ui/TypedChip';

// Local interface to avoid dependency on entities layer
interface Asset {
  id: string;
  name: string;
  type: string;
  relationshipType?: string;
  isArchived?: boolean;
  activity?: {
    totalViews?: number;
    uniqueViewers?: number;
    lastViewed?: string | null;
  };
}

interface AssetRelationshipSectionProps {
  type: 'dashboard' | 'analysis' | 'dataset' | 'datasource';
  assets?: Asset[];
  onAssetClick: (asset: Asset) => void;
}

const assetIcons = {
  dashboard: DashboardIcon,
  analysis: AnalysisIcon,
  dataset: DatasetIcon,
  datasource: DatasourceIcon,
} as const;

const assetPluralLabels = {
  dashboard: 'Dashboards',
  analysis: 'Analyses',
  dataset: 'Datasets',
  datasource: 'Data Sources',
} as const;

export function AssetRelationshipSection({ 
  type, 
  assets = [], 
  onAssetClick 
}: AssetRelationshipSectionProps) {
  const Icon = assetIcons[type];
  const colorConfig = colors.assetTypes[type];
  const hasAssets = assets.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{ 
        p: spacing.md / 8,
        border: `1px solid ${hasAssets ? alpha(colorConfig.main, 0.2) : 'transparent'}`,
        backgroundColor: hasAssets ? alpha(colorConfig.light, 0.3) : 'transparent',
        borderRadius: `${borderRadius.md}px`,
        opacity: hasAssets ? 1 : 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: hasAssets ? 1.5 : 0 }}>
        <Icon sx={{ fontSize: 20, color: hasAssets ? colorConfig.main : 'text.disabled' }} />
        <Typography 
          variant="subtitle1" 
          fontWeight={typography.fontWeight.semibold}
          color={hasAssets ? 'text.primary' : 'text.disabled'}
        >
          {assetPluralLabels[type]}
        </Typography>
        {hasAssets && (
          <TypedChip 
            type={type.toUpperCase() as any}
            count={assets.length}
            showIcon={false}
            size="small"
          />
        )}
      </Box>
      
      {hasAssets && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {assets.map((asset) => (
            <Box
              key={asset.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: spacing.sm / 8 + 0.5,
                backgroundColor: asset.isArchived ? alpha('#ff9800', 0.05) : 'background.paper',
                borderRadius: `${borderRadius.sm}px`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: asset.isArchived ? 0.8 : 1,
                '&:hover': {
                  backgroundColor: asset.isArchived 
                    ? alpha('#ff9800', 0.1) 
                    : alpha(colorConfig.main, 0.05),
                  transform: 'translateX(4px)',
                }
              }}
              onClick={() => onAssetClick(asset)}
            >
              <Box sx={{ overflow: 'hidden', flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography 
                    variant="body2" 
                    fontWeight={typography.fontWeight.medium} 
                    noWrap
                    sx={{
                      textDecoration: asset.isArchived ? 'line-through' : 'none',
                      color: asset.isArchived ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {asset.name}
                  </Typography>
                  {asset.isArchived && (
                    <Tooltip title="This asset has been archived">
                      <Chip
                        icon={<ArchiveIcon sx={{ fontSize: 12 }} />}
                        label="Archived"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          backgroundColor: alpha('#ff9800', 0.15),
                          color: '#ff9800',
                          '& .MuiChip-icon': {
                            marginLeft: '4px',
                            color: '#ff9800',
                          }
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      fontFamily: typography.fontFamily.monospace,
                      fontSize: typography.fontSize.xs,
                    }}
                    noWrap
                  >
                    {asset.id}
                  </Typography>
                  {/* Activity indicator for dashboards and analyses */}
                  {(asset.type === 'dashboard' || asset.type === 'analysis') && asset.activity && asset.activity.totalViews !== undefined && (
                    <Tooltip 
                      title={`${asset.activity.totalViews} views by ${asset.activity.uniqueViewers || 0} users`}
                      placement="top"
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          backgroundColor: asset.activity.totalViews === 0 
                            ? alpha('#000', 0.05) 
                            : alpha(colorConfig.main, 0.1),
                          borderRadius: `${borderRadius.sm}px`,
                          px: 0.5,
                          py: 0.25,
                          cursor: 'help',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: typography.fontWeight.medium,
                            color: asset.activity.totalViews === 0 
                              ? 'text.secondary' 
                              : colorConfig.main,
                          }}
                        >
                          {asset.activity.totalViews >= 1000 
                            ? `${(asset.activity.totalViews / 1000).toFixed(1)}k`
                            : asset.activity.totalViews}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            color: 'text.secondary',
                          }}
                        >
                          views
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1, flexShrink: 0 }} />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}