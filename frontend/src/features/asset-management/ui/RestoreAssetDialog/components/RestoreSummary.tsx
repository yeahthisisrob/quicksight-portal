/**
 * Summary component showing what will be restored
 */
import { Alert, Box, Stack, Typography } from '@mui/material';

import { statusIcons } from '@/shared/ui/icons';

import type { AssetMetadata, ArchivedAssetItem } from '../types';

const CheckCircleIcon = statusIcons.success;

interface RestoreSummaryProps {
  asset: ArchivedAssetItem;
  metadata: AssetMetadata | null;
}

export function RestoreSummary({ asset, metadata }: RestoreSummaryProps) {
  if (!metadata) return null;

  const components = [
    { label: 'Asset Definition', show: true },
    { label: `${metadata.permissions?.length || 0} Permissions`, show: (metadata.permissions?.length ?? 0) > 0 },
    { label: `${metadata.tags?.length || 0} Tags`, show: (metadata.tags?.length ?? 0) > 0 },
    { 
      label: `${metadata.refreshSchedules?.length || 0} Refresh Schedules`, 
      show: asset.type === 'dataset' && (metadata.refreshSchedules?.length ?? 0) > 0 
    },
    { 
      label: `${metadata.folderMemberships?.length || 0} Folder Memberships`, 
      show: (metadata.folderMemberships?.length ?? 0) > 0 
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
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2">{component.label}</Typography>
          </Box>
        ))}
      </Stack>
    </Alert>
  );
}