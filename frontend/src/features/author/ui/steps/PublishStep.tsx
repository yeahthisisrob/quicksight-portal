/**
 * Step 5 - write it. A summary of everything that will change, the folder a
 * copy goes into, one primary action, a confirmation for in-place changes,
 * and a result card with the ways to get at the new asset.
 */
import { Folder, OpenInNew, PlayArrow, Star, StarBorder, ViewQuilt } from '@mui/icons-material';
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
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { WireframeDialog } from '@/entities/definition';

import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import { describeOp, outlineFromModel } from '../../lib/ops';
import { describeParts, describeTypeRules } from '../../model/standard';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { ChangesList } from '../ChangesList';
import { FolderPicker } from '../FolderPicker';
import { KeyValueList } from '../primitives/KeyValue';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

/** The card after a publish: what was written, and the ways to get at it. Shared with the New flow. */
export function ResultPanel({ flow }: { flow: AuthorFlow }) {
  const result = flow.state.result!;
  const [wireframeOpen, setWireframeOpen] = useState(false);
  const [template, setTemplate] = useState(false);
  const consoleUrl = getQuickSightConsoleUrl(result.assetType, result.assetId);
  const noun = result.assetType === 'dashboard' ? 'Dashboard' : 'Analysis';
  const folder = flow.state.folder;
  const created = result.mode !== 'update';
  const folderLabel = result.folderIds.length
    ? result.folderIds
        .map((id) => (folder && folder.id === id ? (folder.path ?? folder.name) : id))
        .join(', ')
    : 'Root (no folder)';

  return (
    <Panel
      title={created ? `${noun} created` : `${noun} updated`}
      description={result.name}
      actions={<StatusIndicator kind="success">Published</StatusIndicator>}
    >
      <Stack spacing={2.5}>
        <KeyValueList
          items={[
            { label: 'Name', value: result.name },
            { label: 'Id', value: <code>{result.assetId}</code> },
            ...(created
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
              variant="contained"
              endIcon={<OpenInNew />}
              href={consoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in QuickSight
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<ViewQuilt />}
            onClick={() => setWireframeOpen(true)}
          >
            View wireframe
          </Button>
          <Button
            variant="outlined"
            startIcon={template ? <Star /> : <StarBorder />}
            onClick={async () => {
              await flow.setTemplate(
                { type: result.assetType, id: result.assetId, name: result.name },
                !template
              );
              setTemplate(!template);
            }}
          >
            {template ? 'Template' : 'Mark as template'}
          </Button>
          <Button variant="outlined" startIcon={<PlayArrow />} onClick={flow.startFromResult}>
            Start another from this
          </Button>
          <Button onClick={flow.reset}>Start over</Button>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          The wireframe reads the portal's export cache, so it says "not cached yet" until the next
          sync picks the new asset up.
        </Typography>
      </Stack>
      <WireframeDialog
        open={wireframeOpen}
        onClose={() => setWireframeOpen(false)}
        assetId={result.assetId}
        assetName={result.name}
        assetType={result.assetType}
      />
    </Panel>
  );
}

export function PublishStep({ flow }: { flow: AuthorFlow }) {
  const [confirm, setConfirm] = useState(false);
  const { draft, state, preview } = flow;
  const source = state.source;

  if (state.result) {
    return <ResultPanel flow={flow} />;
  }
  if (!source) {
    return null;
  }

  const noun = source.type === 'dashboard' ? 'dashboard' : 'analysis';
  const inPlace = draft.mode === 'update';
  const sourceOutline = flow.source.model ? outlineFromModel(flow.source.model) : null;
  const totalRenamed = (draft.plan?.datasets ?? []).reduce((n, d) => n + d.summary.mapped, 0);
  const ready = flow.status.publish !== 'locked' || state.step === 'publish';
  const canPublish =
    !draft.planning &&
    (draft.rebinds.length > 0
      ? draft.canApply
      : inPlace
        ? state.ops.length > 0 ||
          flow.addedFields.length > 0 ||
          flow.standard.active ||
          draft.canApply
        : draft.name.trim().length > 0);

  const run = () => {
    setConfirm(false);
    void flow.publish();
  };

  return (
    <Stack spacing={2.5}>
      <Panel
        title="Publish"
        description={
          inPlace
            ? `Rewrite "${source.name}" in place${source.type === 'dashboard' ? ' and publish a new version' : ''}.`
            : `Create a new ${noun} from "${source.name}".`
        }
        actions={
          canPublish && ready ? (
            <StatusIndicator kind="success">Ready</StatusIndicator>
          ) : (
            <StatusIndicator kind="warning">Not ready</StatusIndicator>
          )
        }
      >
        <Stack spacing={2.5}>
          <KeyValueList
            columns={4}
            items={[
              { label: 'Source', value: source.name },
              { label: 'Mode', value: inPlace ? 'Change in place' : 'Create a copy' },
              { label: 'Name', value: inPlace ? draft.name || source.name : draft.name },
              {
                label: 'Datasets',
                value:
                  draft.rebinds.length === 0
                    ? 'Unchanged'
                    : draft.datasets
                        .filter((d) => draft.targets[d.identifier])
                        .map((d) => `${d.identifier} → ${draft.targets[d.identifier]!.name}`)
                        .join(', '),
              },
              { label: 'Column renames', value: String(totalRenamed) },
              {
                label: 'Repairs',
                value:
                  flow.repair.summary.total === 0
                    ? 'None needed'
                    : `${flow.repair.summary.accepted} of ${flow.repair.summary.total} accepted`,
              },
              {
                label: 'Calculated fields added',
                value:
                  flow.addedFields.length === 0
                    ? 'None'
                    : flow.addedFields.map((f) => `${f.name} (${f.identifier})`).join(', '),
              },
              {
                label: 'Standard',
                value: flow.standard.template
                  ? `${flow.standard.template.name} (${describeParts(flow.standard.template.parts)})`
                  : 'None (layout kept)',
              },
              { label: 'Type rules', value: describeTypeRules(flow.standard.typeRules) },
              {
                label: 'Mockup edits',
                value:
                  state.ops.length === 0
                    ? 'None'
                    : `${state.ops.length}: ${state.ops
                        .map((op) => describeOp(op, sourceOutline))
                        .join('; ')}`,
              },
              {
                label: 'Folder',
                value: inPlace
                  ? 'Unchanged'
                  : state.folder
                    ? (state.folder.path ?? state.folder.name)
                    : 'Root (no folder)',
              },
            ]}
          />

          {flow.preview.warnings.length > 0 && (
            <Alert severity="warning">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Carried with warnings
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {flow.preview.warnings.map((warning) => (
                  <li key={warning}>
                    <Typography variant="body2">{warning}</Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          )}

          {!inPlace && (
            <Box sx={{ maxWidth: 480 }}>
              <FolderPicker
                value={state.folder}
                onChange={flow.setFolder}
                disabled={flow.publishing}
              />
            </Box>
          )}

          {flow.publishError && (
            <Alert severity="error">
              <AlertTitle>QuickSight rejected the change</AlertTitle>
              {flow.publishError}
            </Alert>
          )}

          {!canPublish && (
            <Alert severity="warning">
              {draft.rebinds.length > 0
                ? 'Some columns still need a decision. Go back to review to resolve them.'
                : inPlace
                  ? 'Nothing would change. Choose datasets, edit the mockup or give it a new name.'
                  : 'Give the copy a name in the review step.'}
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={flow.back} disabled={flow.publishing}>
              Back
            </Button>
            <Button
              variant="contained"
              color={inPlace ? 'warning' : 'primary'}
              disabled={!canPublish || flow.publishing}
              startIcon={
                flow.publishing ? <CircularProgress size={16} color="inherit" /> : undefined
              }
              onClick={() => (inPlace ? setConfirm(true) : run())}
            >
              {inPlace ? 'Apply in place' : 'Create copy'}
            </Button>
          </Stack>
        </Stack>

        <Dialog open={confirm} onClose={() => setConfirm(false)}>
          <DialogTitle>Change "{source.name}" in place?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Everyone who uses this {noun} will see the change
              {source.type === 'dashboard' ? ' as soon as the new version publishes' : ''}. This
              cannot be undone from here.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="contained" color="warning" onClick={run}>
              Apply in place
            </Button>
          </DialogActions>
        </Dialog>
      </Panel>

      <Panel
        title="Changes"
        description="Every change in plain language, as the mockup step worked them out."
      >
        <ChangesList
          changes={preview.changes}
          emptyText={
            preview.changes.length === 0 && (draft.rebinds.length > 0 || state.ops.length > 0)
              ? 'Open the mockup step to see the change list.'
              : 'Nothing changes beyond the name.'
          }
        />
      </Panel>
    </Stack>
  );
}
