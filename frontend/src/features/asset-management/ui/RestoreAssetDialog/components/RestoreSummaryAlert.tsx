/**
 * Summary alert component showing what will be restored
 */
import { CheckCircle } from '@mui/icons-material';
import { Alert, Box, Stack, Typography } from '@mui/material';

import type { AssetMetadata, ArchivedAssetItem } from '../types';

interface RestoreSummaryAlertProps {
  asset: ArchivedAssetItem;
  assetMetadata: AssetMetadata | null;
}

export function RestoreSummaryAlert({ asset, assetMetadata }: RestoreSummaryAlertProps) {
  if (!assetMetadata) return null;

  const components = [
    { 
      label: 'Asset Definition', 
      show: true 
    },
    { 
      label: `${assetMetadata.permissions?.length || 0} Permissions`, 
      show: (assetMetadata.permissions?.length ?? 0) > 0 
    },
    { 
      label: `${assetMetadata.tags?.length || 0} Tags`, 
      show: (assetMetadata.tags?.length ?? 0) > 0 
    },
    { 
      label: `${assetMetadata.refreshSchedules?.length || 0} Refresh Schedules`, 
      show: asset.type === 'dataset' && (assetMetadata.refreshSchedules?.length ?? 0) > 0 
    },
    { 
      label: `${assetMetadata.folderMemberships?.length || 0} Folder Memberships`, 
      show: (assetMetadata.folderMemberships?.length ?? 0) > 0 
    },
  ].filter(c => c.show);

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="body2" fontWeight="medium" gutterBottom>
        This restore will include:
      </Typography>
      <Stack direction="row" spacing={3} flexWrap="wrap">
        {components.map((component, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircle color="success" fontSize="small" />
            <Typography variant="body2">{component.label}</Typography>
          </Box>
        ))}
      </Stack>
    </Alert>
  );
}