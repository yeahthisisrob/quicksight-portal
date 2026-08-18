import { ContentCopy as CopyIcon } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';

import type { TimelineEvent } from '@/shared/api/modules/activity';

interface TimelineEventJsonDialogProps {
  open: boolean;
  onClose: () => void;
  event: TimelineEvent;
}

/**
 * Debug view of a timeline event: the stored activity record verbatim
 * (`event.raw` — the compact-key record the CloudTrail ingest kept, including
 * the allowlisted payload slice `d` for mutations) plus the hydrated wire
 * event. The full CloudTrail log is NOT stored, so this is everything the
 * portal knows about the event.
 */
export function TimelineEventJsonDialog({ open, onClose, event }: TimelineEventJsonDialogProps) {
  if (!open) return null;

  const { raw, ...hydrated } = event;
  const payload = { storedRecord: raw ?? null, hydratedEvent: hydrated };
  const json = JSON.stringify(payload, null, 2);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {event.eventName}
          <Typography variant="body2" color="text.secondary">
            {format(new Date(event.timestamp), 'PPpp')} · {event.user}
          </Typography>
        </Box>
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={() => navigator.clipboard.writeText(json)}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          The portal stores a pruned record per event, not the full CloudTrail log — for
          mutations, <code>storedRecord.details</code> holds the allowlisted CloudTrail payload
          slice (ids, names, ARNs, errors).
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            bgcolor: 'grey.900',
            color: 'grey.100',
            borderRadius: 1,
            fontSize: '0.8125rem',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: '60vh',
          }}
        >
          {json}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
