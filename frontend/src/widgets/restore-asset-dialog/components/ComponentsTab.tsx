/**
 * Components tab showing what will be restored
 */
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';

import { colors } from '@/shared/design-system/theme';
import { actionIcons, statusIcons } from '@/shared/ui/icons';

import type { AssetMetadata, ArchivedAssetItem } from '../types';

const ScheduleIcon = actionIcons.schedule;
const RefreshIcon = actionIcons.refresh;
const FolderIcon = actionIcons.folder;
const CheckCircleIcon = statusIcons.success;

interface ComponentsTabProps {
  asset: ArchivedAssetItem;
  metadata: AssetMetadata | null;
  loadingMetadata: boolean;
}

export function ComponentsTab({ asset, metadata, loadingMetadata }: ComponentsTabProps) {
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
        Components to Restore
      </Typography>
      
      <Stack spacing={2}>
        {/* Dataset-specific components */}
        {asset.type === 'dataset' && (
          <>
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: colors.background.subtle }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ScheduleIcon color="primary" />
                <Typography variant="subtitle2">Refresh Schedules</Typography>
              </Box>
              {metadata?.refreshSchedules && metadata.refreshSchedules.length > 0 ? (
                <Stack spacing={1}>
                  {metadata.refreshSchedules.map((schedule: any, index: number) => (
                    <Box key={index} sx={{ pl: 4 }}>
                      <Typography variant="body2">
                        {schedule.ScheduleFrequency?.Interval} - {schedule.ScheduleId}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
                  No refresh schedules configured
                </Typography>
              )}
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: colors.background.subtle }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <RefreshIcon color="primary" />
                <Typography variant="subtitle2">Refresh Properties</Typography>
              </Box>
              {metadata?.refreshProperties ? (
                <Typography variant="body2" sx={{ pl: 4 }}>
                  Refresh properties configured
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
                  No refresh properties configured
                </Typography>
              )}
            </Paper>
          </>
        )}
        
        {/* Common components */}
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: colors.background.subtle }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FolderIcon color="primary" />
            <Typography variant="subtitle2">Folder Memberships</Typography>
          </Box>
          {metadata?.folderMemberships && metadata.folderMemberships.length > 0 ? (
            <Stack spacing={1}>
              {metadata.folderMemberships.map((membership: any, index: number) => (
                <Typography key={index} variant="body2" sx={{ pl: 4 }}>
                  {membership.FolderName || membership.FolderId}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
              Not a member of any folders
            </Typography>
          )}
        </Paper>
        
        <Alert severity="success" icon={<CheckCircleIcon />}>
          All components will be automatically restored with the asset
        </Alert>
      </Stack>
    </Stack>
  );
}