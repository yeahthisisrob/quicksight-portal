/**
 * Confirmation section component for BulkDeleteDialog
 */
import { Box, Typography, TextField } from '@mui/material';

interface ConfirmationSectionProps {
  reason: string;
  setReason: (value: string) => void;
  confirmText: string;
  setConfirmText: (value: string) => void;
  expectedConfirmText: string;
}

export function ConfirmationSection({
  reason,
  setReason,
  confirmText,
  setConfirmText,
  expectedConfirmText,
}: ConfirmationSectionProps) {
  return (
    <>
      {/* Reason Input */}
      <TextField
        fullWidth
        label="Reason for deletion (required)"
        placeholder="e.g., Cleaning up old test assets, Removing deprecated reports..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        multiline
        rows={2}
        required
        error={reason.length > 0 && reason.trim().length === 0}
        helperText="Please provide a reason for audit purposes"
      />

      {/* Confirmation Input */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          To confirm deletion, type: <strong>{expectedConfirmText}</strong>
        </Typography>
        <TextField
          fullWidth
          placeholder="Type confirmation text here"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          error={confirmText.length > 0 && confirmText !== expectedConfirmText}
          sx={{
            '& input': {
              fontFamily: 'monospace',
              letterSpacing: 1,
            },
          }}
        />
      </Box>
    </>
  );
}