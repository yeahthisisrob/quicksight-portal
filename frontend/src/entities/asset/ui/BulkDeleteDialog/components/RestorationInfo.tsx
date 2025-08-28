/**
 * Restoration info component for BulkDeleteDialog
 */
import { 
  Box, 
  Typography, 
  IconButton, 
  Collapse, 
  Stack, 
  Alert 
} from '@mui/material';
import { useState } from 'react';

import { actionIcons, assetIcons } from '@/shared/ui/icons';

import { RESTORATION_INFO ,type  Asset } from '../types';

const ExpandMoreIcon = actionIcons.expand;
const ExpandLessIcon = actionIcons.collapse;

interface RestorationInfoProps {
  assetsByType: Record<string, Asset[]>;
}

export function RestorationInfo({ assetsByType }: RestorationInfoProps) {
  const [showDetails, setShowDetails] = useState(true);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 1,
          cursor: 'pointer',
        }}
        onClick={() => setShowDetails(!showDetails)}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Restoration Capabilities by Asset Type
        </Typography>
        <IconButton size="small" sx={{ ml: 'auto' }}>
          {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      
      <Collapse in={showDetails}>
        <Stack spacing={1}>
          {Object.entries(assetsByType).map(([type, typeAssets]) => {
            const info = RESTORATION_INFO[type as keyof typeof RESTORATION_INFO];
            const AssetIcon = assetIcons[type as keyof typeof assetIcons];
            
            return (
              <Alert
                key={type}
                severity={info.severity}
                sx={{
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <AssetIcon sx={{ fontSize: '1.2rem' }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}s ({typeAssets.length})
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {info.note}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {info.method}
                </Typography>
                <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                  Portal: {info.portalRestore}
                </Typography>
              </Alert>
            );
          })}
        </Stack>
      </Collapse>
    </Box>
  );
}