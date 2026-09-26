/**
 * Save - an action, not a step. Over the asset (a new version for a
 * dashboard) or as a named copy in a folder, with what will be written listed
 * first; afterwards, what was written and the ways to get at it.
 */
import { Folder, OpenInNew, ViewQuilt } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { type RebindMode, WireframeDialog } from '@/entities/definition';

import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import type { StudioFolder, StudioResult } from '../../model/studio';
import type { Studio } from '../../model/useStudio';
import { ChangesList } from '../ChangesList';
import { FolderPicker } from '../FolderPicker';
import { KeyValueList } from '../primitives/KeyValue';

/** What a save wrote, and the ways to get at it. */
function SavedSummary({
  studio,
  result,
  folder,
}: {
  studio: Studio;
  result: StudioResult;
  folder: StudioFolder | null;
}) {
  const [wireframeOpen, setWireframeOpen] = useState(false);
  const consoleUrl = getQuickSightConsoleUrl(result.assetType, result.assetId);
  const copy = result.mode === 'clone';
  const folderLabel = result.folderIds.length
    ? result.folderIds
        .map((id) => (folder && folder.id === id ? (folder.path ?? folder.name) : id))
        .join(', ')
    : 'Root (no folder)';
  return (
    <Stack spacing={2.5}>
      <KeyValueList
        items={[
          { label: 'Name', value: result.name },
          { label: 'Id', value: <code>{result.assetId}</code> },
          ...(copy
            ? [
                {
                  label: 'Folder',
                  value: (
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Folder fontSize="small" sx={{ color: 'text.secondary' }} />
                      <span>{folderLabel}</span>
                    </Stack>
                  ),
                },
              ]
            : []),
          ...(result.versionNumber
            ? [{ label: 'Published version', value: String(result.versionNumber) }]
            : []),
        ]}
      />
      {result.changes && result.changes.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            What changed
          </Typography>
          <ChangesList changes={result.changes} hideCount />
        </Box>
      )}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {consoleUrl && (
          <Button
            variant="outlined"
            endIcon={<OpenInNew />}
            href={consoleUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in QuickSight
          </Button>
        )}
        <Button variant="outlined" startIcon={<ViewQuilt />} onClick={() => setWireframeOpen(true)}>
          View wireframe
        </Button>
        {copy && (
          <Button
            variant="outlined"
            onClick={() =>
              studio.open({ type: result.assetType, id: result.assetId, name: result.name })
            }
          >
            Edit the copy
          </Button>
        )}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        The canvas reads the portal's export cache, so it shows the saved asset once the next sync
        picks it up.
      </Typography>
      <WireframeDialog
        open={wireframeOpen}
        onClose={() => setWireframeOpen(false)}
        assetId={result.assetId}
        assetName={result.name}
        assetType={result.assetType}
      />
    </Stack>
  );
}

interface SaveDialogProps {
  studio: Studio;
  open: boolean;
  onClose: () => void;
}

export function SaveDialog({ studio, open, onClose }: SaveDialogProps) {
  const source = studio.state.source;
  const [mode, setMode] = useState<RebindMode>('update');
  const [name, setName] = useState('');
  const [folder, setFolder] = useState<StudioFolder | null>(null);
  const result = studio.state.result;

  if (!source) {
    return null;
  }
  const noun = source.type === 'dashboard' ? 'dashboard' : 'analysis';
  const copy = mode === 'clone';
  // In place needs something to write; a copy needs a name.
  const ready = studio.canSave && (copy ? name.trim().length > 0 : studio.dirty);
  const { summary } = studio.repair;
  const edits = studio.state.ops.length;

  const close = () => {
    studio.dismissResult();
    onClose();
  };
  const save = async () => {
    await studio.save({ mode, name, folder });
  };

  return (
    <Dialog open={open} onClose={studio.saving ? undefined : close} maxWidth="sm" fullWidth>
      <DialogTitle>
        {result
          ? result.mode === 'clone'
            ? `Created "${result.name}"`
            : `Saved "${result.name}"`
          : `Save "${source.name}"`}
      </DialogTitle>
      <DialogContent>
        {result ? (
          <SavedSummary studio={studio} result={result} folder={folder} />
        ) : (
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <KeyValueList
              columns={2}
              items={[
                {
                  label: 'Edits',
                  value: edits === 0 ? 'None' : String(edits),
                },
                {
                  label: 'Fixes',
                  value:
                    summary.total === 0
                      ? 'None needed'
                      : `${summary.accepted} of ${summary.total} issues`,
                },
              ]}
            />

            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as RebindMode)}>
              <FormControlLabel
                value="update"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Save over this {noun}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Everyone who uses it sees the change
                      {source.type === 'dashboard' ? ' as soon as the new version publishes' : ''}.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="clone"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Save as a copy
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      A new {noun} with its own name, filed in a folder; this one is left alone.
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>

            {copy && (
              <Stack spacing={2}>
                <TextField
                  size="small"
                  label="Name of the copy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`${source.name} (copy)`}
                  autoFocus
                />
                <FolderPicker value={folder} onChange={setFolder} disabled={studio.saving} />
              </Stack>
            )}

            {studio.preview.warnings.length > 0 && (
              <Alert severity="warning">
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {studio.preview.warnings.map((warning) => (
                    <li key={warning}>
                      <Typography variant="body2">{warning}</Typography>
                    </li>
                  ))}
                </Box>
              </Alert>
            )}
            {!studio.canSave && (
              <Alert severity="warning">
                {summary.needsChoice > 0
                  ? 'A dataset that cannot be read still needs one chosen on the Issues panel.'
                  : 'Some columns still do not resolve.'}
              </Alert>
            )}
            {studio.saveError && (
              <Alert severity="error">
                <AlertTitle>QuickSight rejected the change</AlertTitle>
                {studio.saveError}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close} disabled={studio.saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color={copy ? 'primary' : 'warning'}
              disabled={!ready || studio.saving}
              startIcon={studio.saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              onClick={() => void save()}
            >
              {copy ? 'Create copy' : `Save over this ${noun}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
