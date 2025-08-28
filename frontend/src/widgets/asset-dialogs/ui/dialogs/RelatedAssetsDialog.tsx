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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import { RelatedAsset } from '@/entities/asset';

import { borderRadius, typography } from '@/shared/design-system/theme';
import { AssetRelationshipSection } from '@/shared/ui/AssetRelationshipSection';

interface RelatedAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: string;
  relatedAssets: RelatedAsset[] | { usedBy?: RelatedAsset[]; uses?: RelatedAsset[] };
}

const assetTypeConfig = {
  dashboard: { 
    path: '/assets/dashboards',
  },
  analysis: { 
    path: '/assets/analyses',
  },
  dataset: { 
    path: '/assets/datasets',
  },
  datasource: { 
    path: '/assets/datasources',
  },
} as const;

export default function RelatedAssetsDialog({
  open,
  onClose,
  assetName,
  assetType,
  relatedAssets = [],
}: RelatedAssetsDialogProps) {
  const navigate = useNavigate();

  // Handle both flat array and object formats
  let usesArray: RelatedAsset[] = [];
  let usedByArray: RelatedAsset[] = [];

  if (Array.isArray(relatedAssets)) {
    // New format: array of relationships with relationshipType field
    relatedAssets.forEach((rel: any) => {
      // Create RelatedAsset from the relationship data
      const asset: RelatedAsset = {
        id: rel.targetAssetId,
        name: rel.targetAssetName,
        type: rel.targetAssetType,
        isArchived: rel.targetIsArchived,
        relationshipType: rel.relationshipType
      };
      
      if (rel.relationshipType === 'used_by') {
        usedByArray.push(asset);
      } else if (rel.relationshipType === 'uses') {
        usesArray.push(asset);
      }
    });
  } else if (relatedAssets && typeof relatedAssets === 'object') {
    // Old object format with usedBy and uses arrays
    usesArray = relatedAssets.uses || [];
    usedByArray = relatedAssets.usedBy || [];
  }

  // Group each relationship type by asset type
  const usesAssets = usesArray.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<string, RelatedAsset[]>);

  const usedByAssets = usedByArray.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<string, RelatedAsset[]>);

  const handleAssetClick = (asset: { id: string; name: string; type: string }) => {
    const config = assetTypeConfig[asset.type as keyof typeof assetTypeConfig];
    if (config) {
      // Navigate to the list page with the asset name as a search query
      navigate(`${config.path}?search=${encodeURIComponent(asset.name)}`);
      onClose();
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
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
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