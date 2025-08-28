import { Link as LinkIcon } from '@mui/icons-material';
import { Box, Typography, Tooltip, Badge } from '@mui/material';

interface RelatedAssetsColumnProps {
  asset?: any;
  onClick: () => void;
}

export default function RelatedAssetsColumn({ 
  asset,
  onClick 
}: RelatedAssetsColumnProps) {
  // Handle both flat array and object formats
  let totalCount = 0;
  
  if (Array.isArray(asset?.relatedAssets)) {
    // New flat array format
    totalCount = asset.relatedAssets.length;
  } else if (asset?.relatedAssets) {
    // Old object format with usedBy and uses
    const usedByAssets = asset.relatedAssets.usedBy || [];
    const usesAssets = asset.relatedAssets.uses || [];
    totalCount = usedByAssets.length + usesAssets.length;
  }
  
  if (totalCount === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center' }}>
        -
      </Typography>
    );
  }
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <Tooltip title={`View ${totalCount} related asset${totalCount > 1 ? 's' : ''}`}>
        <Badge 
          badgeContent={totalCount} 
          color="primary"
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.75rem',
              height: 20,
              minWidth: 20,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'scale(1.1)',
                backgroundColor: 'primary.dark',
              }
            }
          }}
        >
          <LinkIcon 
            sx={{ 
              fontSize: 20, 
              color: 'action.active',
              transition: 'all 0.2s',
              '&:hover': {
                color: 'primary.main',
              }
            }} 
          />
        </Badge>
      </Tooltip>
    </Box>
  );
}