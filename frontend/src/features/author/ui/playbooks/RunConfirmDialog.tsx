/**
 * The last look before a run: how many assets, what it writes, how careful
 * it is (how many at once, when it stops on failures), and a canary of a
 * few first. A playbook that deletes asks for the count to be typed.
 */
import { PlayArrow } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type { Playbook, RunLimits } from '@/shared/api/modules/playbooks';

const CANARY_SIZE = 5;
/** A canary is offered once a run is bigger than this. */
const CANARY_OVER = 10;
const CONCURRENCY = [1, 2, 4, 8];
const THRESHOLDS = [0.05, 0.1, 0.2, 0.5];
const PERCENT = 100;

export function RunConfirmDialog({
  open,
  playbook,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean;
  playbook: Playbook;
  count: number;
  onClose: () => void;
  onConfirm: (limits: RunLimits, canary?: number) => void;
}) {
  const offerCanary = count > CANARY_OVER;
  const [canary, setCanary] = useState(offerCanary);
  const [concurrency, setConcurrency] = useState(4);
  const [threshold, setThreshold] = useState(0.2);
  const [typed, setTyped] = useState('');
  const runCount = canary && offerCanary ? CANARY_SIZE : count;
  const confirmed = !playbook.deletes || typed.trim() === String(runCount);
  const kinds = playbook.writes.map((w) => `${w}s`).join(', ');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {playbook.deletes ? 'Delete' : 'Change'} {runCount} asset{runCount === 1 ? '' : 's'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {playbook.title} writes to {kinds}. Each asset is checked again just before it is
            changed: one fixed by hand since the preview is skipped, one that now needs a decision
            is left for review.
          </Typography>

          {playbook.deletes && (
            <Alert severity="warning">
              Each is archived first and can be restored from the Studio, but it disappears from
              QuickSight for everyone at once.
            </Alert>
          )}

          {offerCanary && (
            <FormControlLabel
              control={<Checkbox checked={canary} onChange={(e) => setCanary(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2">Run {CANARY_SIZE} first</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    A canary: check them in QuickSight, then run the rest from the same preview.
                  </Typography>
                </Box>
              }
            />
          )}

          <Stack direction="row" spacing={2}>
            <TextField
              select
              size="small"
              label="At once"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              sx={{ width: 140 }}
            >
              {CONCURRENCY.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Stop when failures pass"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              sx={{ width: 220 }}
            >
              {THRESHOLDS.map((t) => (
                <MenuItem key={t} value={t}>
                  {Math.round(t * PERCENT)}% of those tried
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {playbook.deletes && (
            <TextField
              size="small"
              label={`Type ${runCount} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color={playbook.deletes ? 'warning' : 'primary'}
          startIcon={<PlayArrow />}
          disabled={!confirmed || runCount === 0}
          onClick={() =>
            onConfirm(
              { concurrency, failureThreshold: threshold },
              canary && offerCanary ? CANARY_SIZE : undefined
            )
          }
        >
          Run {runCount}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
