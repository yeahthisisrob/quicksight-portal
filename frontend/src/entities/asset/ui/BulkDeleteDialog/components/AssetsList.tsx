/**
 * Assets list component for BulkDeleteDialog
 */
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText 
} from '@mui/material';

import { colors } from '@/shared/design-system/theme';
import { assetIcons } from '@/shared/ui/icons';

import type { Asset } from '../types';

interface AssetsListProps {
  assets: Asset[];
}

function AssetDependencies({ asset }: { asset: Asset }) {
  const hasUsedBy = asset.usedBy && asset.usedBy.length > 0;
  const hasUses = asset.uses && asset.uses.length > 0;

  if (!hasUsedBy && !hasUses) return null;

  return (
    <Box sx={{ ml: 5, mt: 0.5 }}>
      {hasUsedBy && (
        <Box sx={{ mb: 1 }}>
          <Typography 
            variant="caption" 
            color="error" 
            sx={{ fontWeight: 600, display: 'block' }}
          >
            ⚠️ Used by {asset.usedBy?.length} asset{asset.usedBy && asset.usedBy.length > 1 ? 's' : ''}:
          </Typography>
          {asset.usedBy?.map((dep, idx) => {
            const DepIcon = assetIcons[dep.type as keyof typeof assetIcons] || assetIcons.dataset;
            return (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2 }}>
                <DepIcon sx={{ fontSize: '0.875rem', color: colors.assetTypes[dep.type as keyof typeof colors.assetTypes]?.main }} />
                <Typography variant="caption" color="text.secondary">
                  {dep.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
      
      {hasUses && (
        <Box>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ display: 'block' }}
          >
            Uses {asset.uses?.length} asset{asset.uses && asset.uses.length > 1 ? 's' : ''}:
          </Typography>
          {asset.uses?.map((dep, idx) => {
            const DepIcon = assetIcons[dep.type as keyof typeof assetIcons] || assetIcons.dataset;
            return (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2 }}>
                <DepIcon sx={{ fontSize: '0.875rem', color: colors.assetTypes[dep.type as keyof typeof colors.assetTypes]?.main }} />
                <Typography variant="caption" color="text.secondary">
                  {dep.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export function AssetsList({ assets }: AssetsListProps) {
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        Assets to be deleted and their dependencies:
      </Typography>
      <Box
        sx={{
          maxHeight: 300,
          overflowY: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1,
        }}
      >
        <List dense disablePadding>
          {assets.map((asset) => {
            const AssetIcon = assetIcons[asset.type];
            const hasDependencies = (asset.usedBy && asset.usedBy.length > 0) || 
                                   (asset.uses && asset.uses.length > 0);
            
            return (
              <Box key={asset.id} sx={{ mb: hasDependencies ? 2 : 1 }}>
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <AssetIcon 
                      sx={{ 
                        fontSize: '1rem',
                        color: colors.assetTypes[asset.type].main,
                      }} 
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={asset.name}
                    secondary={asset.type}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: hasDependencies ? 600 : 400,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                    }}
                  />
                </ListItem>
                <AssetDependencies asset={asset} />
              </Box>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}