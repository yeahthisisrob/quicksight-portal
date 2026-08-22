
import {
  Close as CloseIcon,
  Link as LinkIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useState, useMemo, useEffect } from 'react';

import { RelatedAsset } from '@/entities/asset';

import { borderRadius, typography } from '@/shared/design-system/theme';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';
import { AssetRelationshipSection } from '@/shared/ui/AssetRelationshipSection';

interface RelatedAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: string;
  relatedAssets: RelatedAsset[] | { usedBy?: RelatedAsset[]; uses?: RelatedAsset[] };
}

export default function RelatedAssetsDialog({
  open,
  onClose,
  assetName,
  assetType,
  relatedAssets = [],
}: RelatedAssetsDialogProps) {
  const [showArchived, setShowArchived] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setShowArchived(false);
    }
  }, [open]);

  // Parse relationships into arrays (with deduplication by id)
  const { allUsesArray, allUsedByArray } = useMemo(() => {
    const usesMap = new Map<string, RelatedAsset>();
    const usedByMap = new Map<string, RelatedAsset>();

    if (Array.isArray(relatedAssets)) {
      relatedAssets.forEach((rel: any) => {
        const asset: RelatedAsset = {
          id: rel.targetAssetId,
          name: rel.targetAssetName,
          type: rel.targetAssetType,
          isArchived: rel.targetIsArchived,
          relationshipType: rel.relationshipType,
          activity: rel.activity,
          tags: rel.tags,
        };

        if (rel.relationshipType === 'used_by') {
          usedByMap.set(asset.id, asset);
        } else if (rel.relationshipType === 'uses') {
          usesMap.set(asset.id, asset);
        }
      });
    } else if (relatedAssets && typeof relatedAssets === 'object') {
      (relatedAssets.uses || []).forEach((a: RelatedAsset) => usesMap.set(a.id, a));
      (relatedAssets.usedBy || []).forEach((a: RelatedAsset) => usedByMap.set(a.id, a));
    }

    return {
      allUsesArray: Array.from(usesMap.values()),
      allUsedByArray: Array.from(usedByMap.values()),
    };
  }, [relatedAssets]);

  // Count archived assets
  const archivedCount = useMemo(() =>
    allUsesArray.filter(a => a.isArchived).length +
    allUsedByArray.filter(a => a.isArchived).length,
  [allUsesArray, allUsedByArray]);

  // Filter and group assets
  const { usesArray, usedByArray, usesAssets, usedByAssets } = useMemo(() => {
    const sortByViews = (a: RelatedAsset, b: RelatedAsset) =>
      (b.activity?.totalViews || 0) - (a.activity?.totalViews || 0);

    // Filter based on toggle (always create new arrays to avoid mutation)
    const filteredUses = showArchived
      ? [...allUsesArray]
      : allUsesArray.filter(a => !a.isArchived);
    const filteredUsedBy = showArchived
      ? [...allUsedByArray]
      : allUsedByArray.filter(a => !a.isArchived);

    // Group by asset type
    const usesGrouped = filteredUses.reduce((acc, asset) => {
      if (!acc[asset.type]) acc[asset.type] = [];
      acc[asset.type].push(asset);
      return acc;
    }, {} as Record<string, RelatedAsset[]>);

    const usedByGrouped = filteredUsedBy.reduce((acc, asset) => {
      if (!acc[asset.type]) acc[asset.type] = [];
      acc[asset.type].push(asset);
      return acc;
    }, {} as Record<string, RelatedAsset[]>);

    // Sort dashboards and analyses by views
    if (usesGrouped.dashboard) usesGrouped.dashboard.sort(sortByViews);
    if (usesGrouped.analysis) usesGrouped.analysis.sort(sortByViews);
    if (usedByGrouped.dashboard) usedByGrouped.dashboard.sort(sortByViews);
    if (usedByGrouped.analysis) usedByGrouped.analysis.sort(sortByViews);

    return {
      usesArray: filteredUses,
      usedByArray: filteredUsedBy,
      usesAssets: usesGrouped,
      usedByAssets: usedByGrouped,
    };
  }, [allUsesArray, allUsedByArray, showArchived]);

  const handleAssetClick = (asset: { id: string; name: string; type: string }) => {
    const url = getQuickSightConsoleUrl(asset.type, asset.id);
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${borderRadius.lg}px`,
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={typography.fontWeight.semibold} gutterBottom>
              Asset Relationships
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={assetType}
                size="small"
                sx={{ 
                  fontWeight: typography.fontWeight.medium,
                  textTransform: 'capitalize',
                }}
              />
              <Typography variant="body1" color="text.secondary">
                {assetName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {archivedCount > 0 && (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    Show archived ({archivedCount})
                  </Typography>
                }
                sx={{ mr: 1 }}
              />
            )}
            <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', minHeight: 400 }}>
          {/* Left Column - Used By */}
          <Box sx={{ 
            p: 3, 
            borderRight: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'grey.50',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <ArrowBackIcon sx={{ color: 'secondary.main' }} />
              <Typography variant="h6" fontWeight={typography.fontWeight.semibold}>
                Used By
              </Typography>
              <Chip 
                label={usedByArray.length} 
                size="small" 
                color="secondary"
                sx={{ fontWeight: typography.fontWeight.semibold }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(['dashboard', 'analysis', 'dataset', 'datasource'] as const).map((type) => (
                <AssetRelationshipSection
                  key={type}
                  type={type}
                  assets={usedByAssets[type]}
                  onAssetClick={handleAssetClick}
                />
              ))}
            </Box>
          </Box>

          {/* Right Column - Uses */}
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <ArrowForwardIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={typography.fontWeight.semibold}>
                Uses
              </Typography>
              <Chip 
                label={usesArray.length} 
                size="small" 
                color="primary"
                sx={{ fontWeight: typography.fontWeight.semibold }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(['dashboard', 'analysis', 'dataset', 'datasource'] as const).map((type) => (
                <AssetRelationshipSection
                  key={type}
                  type={type}
                  assets={usesAssets[type]}
                  onAssetClick={handleAssetClick}
                />
              ))}
            </Box>
          </Box>

          {/* No Related Assets Message - Spans both columns */}
          {usesArray.length === 0 && usedByArray.length === 0 && (
            <Box sx={{ 
              gridColumn: '1 / -1', 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
            }}>
              <LinkIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No related assets found
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}