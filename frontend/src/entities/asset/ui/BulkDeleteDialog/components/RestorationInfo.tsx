import { UnfoldLess as ExpandLessIcon, UnfoldMore as ExpandMoreIcon } from '@mui/icons-material';
/**
 * Restoration info component for BulkDeleteDialog
 */
import { Alert, Box, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { assetIcons } from '@/shared/ui/icons';

import { type Asset, RESTORATION_INFO } from '../types';

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
        <Typography sx={{ fontWeight: 600 }} variant="subtitle1">
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
                  <Typography sx={{ fontWeight: 600 }} variant="subtitle2">
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
