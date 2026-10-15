import { Close as CloseIcon } from '@mui/icons-material';
import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';

import { VersionHistory, type VersionHistoryProps } from './VersionHistory';

interface VersionHistoryDialogProps extends Omit<VersionHistoryProps, 'layout'> {
  open: boolean;
  onClose: () => void;
}

/** The asset's history as the asset rows open it: the list beside the version opened. */
export function VersionHistoryDialog({ open, onClose, ...props }: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        Version history
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {props.assetName}
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>{open && <VersionHistory {...props} layout="split" />}</DialogContent>
    </Dialog>
  );
}
