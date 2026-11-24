/**
 * MetadataSyncPanel - the Metadata sync card on Operations.
 *
 * AWS keeps a table's description in Glue and in SageMaker Unified Studio
 * and copies it between neither. This card previews and runs the sync that
 * does: what was adopted from an edit, what was or would be written where,
 * and the fields two places disagree on, which wait here for a person to
 * pick. It is off until Settings turns it on.
 */
import { CompareArrows, PlayArrow, Visibility } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import type { JobMetadata } from '@/shared/api/modules/jobs';
import type {
  MetadataSyncConflict,
  MetadataSyncReport,
  MetadataSyncResolveRequest,
  MetadataSyncSideResult,
  MetadataSyncStatus,
  MetadataSyncTableResult,
} from '@/shared/api/modules/metadataSync';
import {
  Container,
  EmptyState,
  SegmentedControl,
  StatStrip,
  StatusIndicator,
  type StatusType,
} from '@/shared/design-system';

import { groupRefusals, type RefusalGroup } from '../lib/refusals';
import { useMetadataSync } from '../model/useMetadataSync';

const PROGRESS_MAX = 100;
const TABLE_KEY = '#table';
/** How many refused tables a group names before it counts the rest. */
const TABLES_SHOWN = 6;
/** A long description is shown cut; the whole text is in the title. */
const TEXT_MAX = 140;

const cut = (text: string) => (text.length <= TEXT_MAX ? text : `${text.slice(0, TEXT_MAX - 1)}…`);
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** A place by the name a person knows: Glue, or SMUS. */
const placeName = (side: string) => (side === 'glue' ? 'Glue' : 'SMUS');
const fieldName = (key: string, field: string) =>
  `${key === TABLE_KEY ? 'the table' : key} ${field === 'businessName' ? 'business name' : 'description'}`;

const OUTCOME_TONE: Record<MetadataSyncSideResult['outcome'], { type: StatusType; label: string }> =
  {
    written: { type: 'success', label: 'Written' },
    'would-write': { type: 'pending', label: 'Would write' },
    unchanged: { type: 'success', label: 'Unchanged' },
    missing: { type: 'warning', label: 'Not found' },
    skipped: { type: 'stopped', label: 'Skipped' },
    failed: { type: 'error', label: 'Failed' },
  };

function JobProgress({ job }: { job: JobMetadata }) {
  const active = job.status === 'queued' || job.status === 'processing';
  const progress = Math.min(job.progress ?? 0, PROGRESS_MAX);
  if (!active && job.status !== 'failed') {
    return null;
  }
  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <StatusIndicator type={active ? 'in-progress' : 'error'}>
          {active ? 'Running' : 'Failed'}
        </StatusIndicator>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {job.message}
        </Typography>
      </Stack>
      {active && (
        <LinearProgress
          variant={progress === 0 ? 'indeterminate' : 'determinate'}
          value={progress}
          sx={{ mt: 1 }}
        />
      )}
      {job.status === 'failed' && job.error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {job.error}
        </Alert>
      )}
    </Box>
  );
}

function ConflictRow({
  table,
  conflict,
  settled,
  busy,
  onPick,
}: {
  table: MetadataSyncTableResult;
  conflict: MetadataSyncConflict;
  settled: string | undefined;
  busy: boolean;
  onPick: (pick: MetadataSyncResolveRequest) => void;
}) {
  const choices = [
    ...Object.entries(conflict.sides).map(([side, value]) => ({ from: placeName(side), value })),
    ...(conflict.kept ? [{ from: 'the portal', value: conflict.kept }] : []),
  ];
  return (
    <Box sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {table.database}.{table.table}: {fieldName(conflict.key, conflict.field)}
      </Typography>
      {settled !== undefined ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Settled. The next run writes: {cut(settled)}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {choices.map((choice) => (
            <Stack
              key={`${choice.from}:${choice.value}`}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'flex-start' }}
            >
              <Button
                size="small"
                variant="outlined"
                disabled={busy}
                sx={{ flexShrink: 0 }}
                onClick={() =>
                  onPick({
                    database: table.database,
                    table: table.table,
                    key: conflict.key,
                    field: conflict.field,
                    value: choice.value,
                    sides: conflict.sides,
                  })
                }
              >
                Keep what {choice.from} says
              </Button>
              <Typography variant="body2" title={choice.value} sx={{ minWidth: 0, pt: 0.5 }}>
                {cut(choice.value)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** One missing grant: what it is, the tables it stopped, and the fix. */
function Refusal({ group }: { group: RefusalGroup }) {
  const more = group.tables.length - TABLES_SHOWN;
  return (
    <Alert severity={group.kind === 'other' ? 'error' : 'warning'}>
      <Typography variant="subtitle2">
        {group.title} ({plural(group.tables.length, 'table')})
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {group.fix}
      </Typography>
      {group.command && (
        <Box
          component="code"
          sx={{ display: 'block', mt: 1, fontSize: 13, overflowWrap: 'anywhere' }}
        >
          {group.command}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {group.tables.slice(0, TABLES_SHOWN).join(', ')}
        {more > 0 ? ` and ${more.toLocaleString()} more` : ''}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        title={group.example}
        sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
      >
        AWS said: {cut(group.example)}
      </Typography>
    </Alert>
  );
}

function ChangesTable({ report }: { report: MetadataSyncReport }) {
  // A refusal is shown once, by what is missing, above; a row each would bury the rest.
  const rows = report.tables.flatMap((table) =>
    table.sides.filter((side) => side.writes.length > 0).map((side) => ({ table, side }))
  );
  if (rows.length === 0) {
    return null;
  }
  return (
    <Table size="small" aria-label="What each place gets">
      <TableHead>
        <TableRow>
          <TableCell>Table</TableCell>
          <TableCell>Place</TableCell>
          <TableCell>Result</TableCell>
          <TableCell>Fields</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(({ table, side }) => {
          const tone = OUTCOME_TONE[side.outcome];
          return (
            <TableRow key={`${table.database}.${table.table}:${side.side}`}>
              <TableCell>
                {table.database}.{table.table}
              </TableCell>
              <TableCell>
                {placeName(side.kind)}
                {side.kind === 'smus' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {side.label}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <StatusIndicator type={tone.type} size="small">
                  {tone.label}
                </StatusIndicator>
              </TableCell>
              <TableCell>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {side.writes.map((write) => (
                    <Chip
                      key={`${write.key}:${write.field}`}
                      size="small"
                      variant="outlined"
                      title={write.was ? `${write.was} → ${write.value}` : write.value}
                      label={write.key === TABLE_KEY ? `table ${write.field}` : write.key}
                    />
                  ))}
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReportView({
  report,
  busy,
  onPick,
  settled,
}: {
  report: MetadataSyncReport;
  busy: boolean;
  onPick: (pick: MetadataSyncResolveRequest) => void;
  settled: Record<string, string>;
}) {
  const preview = report.mode === 'preview';
  const conflicts = report.tables.flatMap((table) =>
    table.conflicts.map((conflict) => ({ table, conflict }))
  );
  const adoptions = report.tables.flatMap((table) =>
    table.adoptions.map((adoption) => ({ table, adoption }))
  );
  const refusals = groupRefusals(report);
  return (
    <Stack spacing={2.5}>
      <StatStrip
        ariaLabel={preview ? 'Last preview' : 'Last run'}
        items={[
          { label: 'Tables read', value: report.totals.tables.toLocaleString() },
          { label: 'Edits adopted', value: report.totals.adoptions.toLocaleString() },
          {
            label: preview ? 'Fields to write' : 'Fields written',
            value: report.totals.writes.toLocaleString(),
          },
          { label: 'Conflicts', value: report.totals.conflicts.toLocaleString() },
          {
            label: preview ? 'Previewed' : 'Ran',
            value: formatDistanceToNow(new Date(report.finishedAt), { addSuffix: true }),
            hint: report.startedBy ? `by ${report.startedBy}` : undefined,
          },
        ]}
      />
      {refusals.map((group) => (
        <Refusal key={group.kind} group={group} />
      ))}
      {conflicts.length > 0 && (
        <Box>
          <Typography variant="subtitle2">
            {plural(conflicts.length, 'conflict')}: nothing is written for these until you pick
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            The same field says different things in two places, and the sync cannot tell which is
            newer.
          </Typography>
          {conflicts.map(({ table, conflict }) => {
            const id = `${table.database}.${table.table}:${conflict.key}:${conflict.field}`;
            return (
              <ConflictRow
                key={id}
                table={table}
                conflict={conflict}
                settled={settled[id]}
                busy={busy}
                onPick={onPick}
              />
            );
          })}
        </Box>
      )}
      {adoptions.length > 0 && (
        <Box>
          <Typography variant="subtitle2">
            {plural(adoptions.length, 'edit')} {preview ? 'to adopt' : 'adopted'}
          </Typography>
          {adoptions.map(({ table, adoption }) => (
            <Typography
              key={`${table.database}.${table.table}:${adoption.key}:${adoption.field}`}
              variant="body2"
              color="text.secondary"
              title={adoption.value}
              sx={{ mt: 0.5 }}
            >
              {table.database}.{table.table}: {fieldName(adoption.key, adoption.field)} from{' '}
              {placeName(adoption.from)}: {cut(adoption.value)}
            </Typography>
          ))}
        </Box>
      )}
      <ChangesTable report={report} />
      {report.tables.length === 0 && (
        <Alert severity="success" icon={false}>
          Every table says the same thing in every place.
        </Alert>
      )}
    </Stack>
  );
}

type Shown = 'preview' | 'run';

function Body({ status }: { status: MetadataSyncStatus }) {
  if (!status.turnedOn) {
    return (
      <EmptyState
        compact
        icon={<CompareArrows />}
        title="Metadata sync is turned off"
        description="It writes table and column descriptions into Glue and SageMaker Unified Studio, the one thing in the portal that writes outside QuickSight, so a deployment turns it on in Settings."
        action={
          <Button component={RouterLink} to="/settings" variant="contained">
            Open Settings
          </Button>
        }
      />
    );
  }
  if (!status.smusConfigured) {
    return (
      <EmptyState
        compact
        icon={<CompareArrows />}
        title="SageMaker Unified Studio is not connected"
        description="The sync reads which tables to keep in step from the SMUS export. Set the domain in Settings and run the export first."
        action={
          <Button component={RouterLink} to="/settings" variant="contained">
            Open Settings
          </Button>
        }
      />
    );
  }
  return null;
}

export function MetadataSyncPanel() {
  const sync = useMetadataSync();
  const status = sync.status.data;
  const [picked, setPicked] = useState<Shown | null>(null);
  const [settled, setSettled] = useState<Record<string, string>>({});

  const reports = { preview: status?.lastPreview ?? null, run: status?.lastRun ?? null };
  const newest: Shown | null =
    reports.preview && reports.run
      ? reports.preview.finishedAt > reports.run.finishedAt
        ? 'preview'
        : 'run'
      : reports.preview
        ? 'preview'
        : reports.run
          ? 'run'
          : null;
  const shown = picked && reports[picked] ? picked : newest;
  const report = shown ? reports[shown] : null;

  const onPick = (pick: MetadataSyncResolveRequest) => {
    sync.resolve.mutate(pick, {
      onSuccess: () =>
        setSettled((prev) => ({
          ...prev,
          [`${pick.database}.${pick.table}:${pick.key}:${pick.field}`]: pick.value,
        })),
    });
  };
  const start = (mode: Shown) => {
    setPicked(mode);
    setSettled({});
    void sync.start(mode);
  };

  return (
    <Container
      header="Metadata sync"
      description="Keeps each table and column description the same in Glue and in SageMaker Unified Studio. An edit made in either is adopted and copied to the other, and text is put back on a table that was dropped and created again. A preview writes nothing."
      actions={
        status?.enabled ? (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Visibility />}
              onClick={() => start('preview')}
              disabled={sync.running}
            >
              Preview
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={() => start('run')}
              disabled={sync.running}
            >
              Run sync
            </Button>
          </Stack>
        ) : undefined
      }
    >
      <Stack spacing={2.5}>
        {sync.startError && <Alert severity="error">{sync.startError}</Alert>}
        {sync.job && <JobProgress job={sync.job} />}
        {sync.status.isLoading ? (
          <LinearProgress />
        ) : sync.status.isError ? (
          <Alert severity="error">
            {getApiErrorMessage(sync.status.error, 'The metadata sync status could not be read')}
          </Alert>
        ) : status && !status.enabled ? (
          <Body status={status} />
        ) : report && shown ? (
          <>
            {reports.preview && reports.run && (
              <SegmentedControl
                ariaLabel="Which report"
                value={shown}
                onChange={(value) => setPicked(value as Shown)}
                options={[
                  { value: 'preview', label: 'Last preview' },
                  { value: 'run', label: 'Last run' },
                ]}
              />
            )}
            <ReportView
              report={report}
              busy={sync.resolve.isPending}
              onPick={onPick}
              settled={settled}
            />
          </>
        ) : (
          <EmptyState
            compact
            icon={<CompareArrows />}
            title="No preview yet"
            description="A preview reads every table the SMUS export knows and says what a run would adopt and write. It changes nothing."
            action={
              <Button
                variant="contained"
                startIcon={<Visibility />}
                onClick={() => start('preview')}
                disabled={sync.running}
              >
                Preview
              </Button>
            }
          />
        )}
      </Stack>
    </Container>
  );
}
