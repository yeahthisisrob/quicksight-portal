/**
 * Playbooks in the Studio: the catalog, then one playbook on one page:
 * set it up, preview what it would touch, choose, confirm, watch it run.
 * Nothing moves on its own: every write waits for Run.
 */
import { ArrowBack, PlayArrow, Refresh, Replay, Stop } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type { JobMetadata } from '@/shared/api/modules/jobs';

import { type PlaybookFlow, usePlaybook, usePlaybookCatalog } from '../../model/usePlaybook';
import { Panel } from '../primitives/Panel';
import { PlaybookCatalog } from './PlaybookCatalog';
import { PlaybookRows } from './PlaybookRows';
import { PlaybookSetup } from './PlaybookSetup';
import { RunConfirmDialog } from './RunConfirmDialog';

function JobBar({ job, onStop }: { job: JobMetadata | null; onStop: () => void }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }} noWrap>
          {job?.message ?? 'Starting'}
        </Typography>
        <LinearProgress
          variant={job?.progress ? 'determinate' : 'indeterminate'}
          value={job?.progress ?? 0}
        />
      </Box>
      <Button
        size="small"
        startIcon={<Stop />}
        onClick={onStop}
        disabled={job?.status === 'stopping'}
      >
        {job?.status === 'stopping' ? 'Stopping' : 'Stop'}
      </Button>
    </Stack>
  );
}

function RunSummary({ flow }: { flow: PlaybookFlow }) {
  const job = flow.run.job;
  const counts = flow.run.page?.counts;
  if (!job || !counts) return null;
  const severity =
    job.status === 'failed' ? 'error' : counts.failed || counts.review ? 'warning' : 'success';
  const chosen = flow.selected.size;
  const remaining = chosen > counts.total;
  return (
    <Stack spacing={1.5}>
      <Alert severity={severity}>{job.message}</Alert>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {counts.failed > 0 && (
          <Button
            variant="outlined"
            startIcon={<Replay />}
            onClick={flow.retryFailed}
            disabled={flow.busy}
          >
            Retry {counts.failed} failed
          </Button>
        )}
        {remaining && (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => flow.startRun()}
            disabled={flow.busy}
          >
            Run the rest
          </Button>
        )}
        <Button startIcon={<Refresh />} onClick={flow.edit}>
          New preview
        </Button>
      </Stack>
    </Stack>
  );
}

/** One playbook's page, driven by a flow (stories hand it a canned one). */
export function PlaybookFlowView({ flow }: { flow: PlaybookFlow }) {
  const [confirming, setConfirming] = useState(false);
  const { playbook, stage } = flow;
  if (!playbook) return null;
  const chosen = flow.selected.size;
  const changeCount = flow.preview.page?.counts.verdicts.change ?? 0;

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Tooltip title="All playbooks">
          <IconButton onClick={flow.close} aria-label="All playbooks">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {playbook.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {playbook.description}
          </Typography>
        </Box>
        {playbook.deletes && <Chip color="warning" size="small" label="Deletes (archived first)" />}
      </Stack>

      {flow.error && <Alert severity="error">{flow.error}</Alert>}

      {stage === 'setup' ? (
        <Panel title="Set it up">
          <PlaybookSetup
            playbook={playbook}
            params={flow.params}
            onParam={flow.setParam}
            gates={flow.gates}
            onGate={flow.setGate}
            ready={flow.ready}
            busy={flow.busy}
            onPreview={flow.startPreview}
          />
        </Panel>
      ) : (
        <Panel
          title={stage === 'running' || stage === 'ran' ? 'Run' : 'What it would do'}
          description={
            stage === 'previewing'
              ? 'Checking every asset in scope; nothing is changed.'
              : stage === 'scope'
                ? 'Untick anything to leave alone. Rows for review need a person; open them in the Studio.'
                : undefined
          }
          actions={
            stage === 'scope' ? (
              <Button size="small" onClick={flow.edit}>
                Change the setup
              </Button>
            ) : undefined
          }
        >
          <Stack spacing={2}>
            {stage === 'previewing' && <JobBar job={flow.preview.job} onStop={flow.stop} />}
            {stage === 'running' && <JobBar job={flow.run.job} onStop={flow.stop} />}
            {stage === 'ran' && <RunSummary flow={flow} />}
            {flow.preview.job?.status === 'failed' && (
              <Alert severity="error">{flow.preview.job.error ?? flow.preview.job.message}</Alert>
            )}

            {stage === 'running' || stage === 'ran' ? (
              <PlaybookRows page={flow.run.page} mode="run" loading={!flow.run.page} />
            ) : (
              <PlaybookRows
                page={flow.preview.page}
                mode="preview"
                selected={flow.selected}
                onSelected={flow.setSelected}
                loading={!flow.preview.page}
              />
            )}

            {stage === 'scope' && (
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  position: 'sticky',
                  bottom: 0,
                  py: 1.5,
                  bgcolor: 'background.paper',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {chosen} of {changeCount} chosen to change
                </Typography>
                <Button
                  variant="contained"
                  color={playbook.deletes ? 'warning' : 'primary'}
                  startIcon={<PlayArrow />}
                  disabled={chosen === 0 || flow.busy}
                  onClick={() => setConfirming(true)}
                >
                  Run…
                </Button>
              </Stack>
            )}
          </Stack>
        </Panel>
      )}

      {confirming && (
        <RunConfirmDialog
          open
          playbook={playbook}
          count={chosen}
          onClose={() => setConfirming(false)}
          onConfirm={(limits, canary) => {
            setConfirming(false);
            flow.startRun(limits, canary);
          }}
        />
      )}
    </Stack>
  );
}

export function PlaybooksView() {
  const catalog = usePlaybookCatalog();
  const flow = usePlaybook();
  if (flow.playbook) {
    return <PlaybookFlowView flow={flow} />;
  }
  return (
    <PlaybookCatalog
      playbooks={catalog.playbooks}
      loading={catalog.loading}
      error={catalog.error}
      onOpen={catalog.open}
    />
  );
}
