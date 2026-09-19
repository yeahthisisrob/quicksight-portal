/**
 * Step 5 - write it. A summary, one primary action, a confirmation for
 * in-place changes, and a result card with the ways to get at the new asset.
 */
import { OpenInNew, Star, StarBorder, ViewQuilt } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
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

import type { AuthorFlow } from '../../model/useAuthorFlow';
import { KeyValueList } from '../primitives/KeyValue';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

function ResultPanel({ flow }: { flow: AuthorFlow }) {
  const result = flow.state.result!;
  const [wireframeOpen, setWireframeOpen] = useState(false);
  const [template, setTemplate] = useState(false);
  const consoleUrl = getQuickSightConsoleUrl(result.assetType, result.assetId);
  const noun = result.assetType === 'dashboard' ? 'Dashboard' : 'Analysis';

  return (
    <Panel
      title={result.mode === 'clone' ? `${noun} created` : `${noun} updated`}
      description={result.name}
      actions={<StatusIndicator kind="success">Published</StatusIndicator>}
    >
      <Stack spacing={2.5}>
        <KeyValueList
          items={[
            { label: 'Name', value: result.name },
            { label: 'Id', value: <code>{result.assetId}</code> },
            ...(result.versionNumber
              ? [{ label: 'Published version', value: String(result.versionNumber) }]
              : []),
          ]}
        />
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
          <Button onClick={flow.reset}>Start another</Button>
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
  const { draft } = flow;
  const source = flow.state.source;

  if (flow.state.result) {
    return <ResultPanel flow={flow} />;
  }
  if (!source) {
    return null;
  }

  const noun = source.type === 'dashboard' ? 'dashboard' : 'analysis';
  const inPlace = draft.mode === 'update';
  const totalRenamed = (draft.plan?.datasets ?? []).reduce((n, d) => n + d.summary.mapped, 0);

  const run = () => {
    setConfirm(false);
    void flow.publish();
  };

  return (
    <Panel
      title="Publish"
      description={
        inPlace
          ? `Rewrite "${source.name}" in place${source.type === 'dashboard' ? ' and publish a new version' : ''}.`
          : `Create a new ${noun} from "${source.name}".`
      }
      actions={
        draft.canApply ? (
          <StatusIndicator kind="success">Ready</StatusIndicator>
        ) : (
          <StatusIndicator kind="warning">Not ready</StatusIndicator>
        )
      }
    >
      <Stack spacing={2.5}>
        <KeyValueList
          items={[
            { label: 'Source', value: source.name },
            { label: 'Result', value: inPlace ? 'Same asset, changed in place' : draft.name },
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
          ]}
        />

        {flow.publishError && (
          <Alert severity="error">
            <AlertTitle>QuickSight rejected the change</AlertTitle>
            {flow.publishError}
          </Alert>
        )}

        {!draft.canApply && (
          <Alert severity="warning">
            Some columns still need a decision. Go back to review to resolve them.
          </Alert>
        )}

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={flow.back} disabled={flow.publishing}>
            Back
          </Button>
          <Button
            variant="contained"
            color={inPlace ? 'warning' : 'primary'}
            disabled={!draft.canApply || flow.publishing}
            startIcon={flow.publishing ? <CircularProgress size={16} color="inherit" /> : undefined}
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
            Everyone who uses this {noun} will see the new datasets
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
  );
}
