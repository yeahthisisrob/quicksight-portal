import {
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
/**
 * Permissions tab component for RestoreAssetDialog
 */
import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';

import { colors } from '@/shared/design-system/theme';

import type { AssetMetadata } from '../types';

interface PermissionsTabProps {
  metadata: AssetMetadata | null;
  loadingMetadata: boolean;
}

export function PermissionsTab({ metadata, loadingMetadata }: PermissionsTabProps) {
  if (loadingMetadata) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" gutterBottom>
        Permissions to Restore
      </Typography>

      {metadata?.permissions && metadata.permissions.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: colors.background.subtle }}>
          <Stack spacing={2}>
            {metadata.permissions.map((permission: any, index: number) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {permission.Principal?.includes('group') ? (
                  <GroupIcon color="action" />
                ) : (
                  <PersonIcon color="action" />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 'medium' }} variant="body2">
                    {permission.Principal}
                  </Typography>
                  <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5}>
                    {permission.Actions?.map((action: string, idx: number) => (
                      <Chip
                        key={idx}
                        label={action.replace('quicksight:', '')}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    ))}
                  </Stack>
                </Box>
                <CheckCircleIcon color="success" fontSize="small" />
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : (
        <Alert severity="info">No permissions found in the archived asset</Alert>
      )}

      <Alert severity="info" icon={<InfoIcon />}>
        All permissions from the archived asset will be restored. You can modify them after
        restoration if needed.
      </Alert>
    </Stack>
  );
}
