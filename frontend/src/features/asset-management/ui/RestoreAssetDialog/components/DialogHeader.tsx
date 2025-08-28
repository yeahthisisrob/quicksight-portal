/**
 * Dialog header component
 */
import { Box, DialogTitle, IconButton, Typography } from '@mui/material';

import { actionIcons } from '@/shared/ui/icons';

const RestoreIcon = actionIcons.restore;
const CloseIcon = actionIcons.close;

interface DialogHeaderProps {
  assetType: string;
  assetName: string;
  onClose: () => void;
  disabled: boolean;
}

export function DialogHeader({ assetType, assetName, onClose, disabled }: DialogHeaderProps) {
  return (
    <DialogTitle>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreIcon color="primary" />
          <Typography variant="h6">Restore {assetType}: {assetName}</Typography>
        </Box>
        <IconButton onClick={onClose} disabled={disabled}>
          <CloseIcon />
        </IconButton>
      </Box>
    </DialogTitle>
  );
}