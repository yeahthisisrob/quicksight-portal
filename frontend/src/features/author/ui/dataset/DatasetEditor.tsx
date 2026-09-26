/**
 * One dataset in the Studio: where it reads from (edited here: data source,
 * catalog, schema, table or query, and its name), what reads it, the
 * calculated fields defined on it, and its SMUS governance. Columns are
 * never rewritten, so everything downstream keeps working; a save says how
 * much reads it before it goes.
 */
import { ArrowBack, OpenInNew, Save, Undo } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { DatasetSourceTables, useDatasetSourceDraft } from '@/entities/dataset';
import type { RebindSource } from '@/entities/definition';
import { SmusLinkBadge, useSmusDatasetLinks, useSmusStatus } from '@/entities/smus';

import { type ContextHit, contextApi } from '@/shared/api/modules/search';
import { announceAssetChanges } from '@/shared/lib/assetChanges';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import { Panel } from '../primitives/Panel';

const RELATED_LIMIT = 100;

function idOf(hit: ContextHit): string {
  return hit.entityId.slice(hit.entityId.indexOf(':') + 1);
}

function useRelated(datasetId: string, relation: string, types: string[]) {
  return useQuery({
    queryKey: ['context-related', datasetId, relation, types],
    queryFn: () =>
      contextApi.related(`dataset:${datasetId}`, {
        relations: [relation],
        direction: 'in',
        types,
        limit: RELATED_LIMIT,
      }),
  });
}

function ReadersPanel({
  datasetId,
  onOpen,
}: {
  datasetId: string;
  onOpen: (source: RebindSource) => void;
}) {
  const readers = useRelated(datasetId, 'uses-dataset', ['dashboard', 'analysis']);
  const hits = readers.data?.hits ?? [];
  return (
    <Panel
      title="What reads it"
      description={
        readers.isLoading
          ? undefined
          : hits.length
            ? `${hits.length} dashboard${hits.length === 1 ? '' : 's'} and analyses. Columns are kept on every save, so they keep working.`
            : 'Nothing reads it.'
      }
    >
      {readers.isLoading ? (
        <CircularProgress size={20} />
      ) : readers.error ? (
        <Alert severity="warning">The context graph could not be read.</Alert>
      ) : (
        <List dense disablePadding>
          {hits.map((hit) => (
            <ListItemButton
              key={hit.entityId}
              sx={{ borderRadius: 1 }}
              onClick={() =>
                onOpen({ type: hit.type as RebindSource['type'], id: idOf(hit), name: hit.name })
              }
            >
              <ListItemText
                primary={hit.name}
                secondary={hit.type}
                slotProps={{ primary: { variant: 'body2', noWrap: true } }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Panel>
  );
}

function CalculatedFieldsPanel({ datasetId }: { datasetId: string }) {
  const fields = useRelated(datasetId, 'defined-in', ['calculated-field']);
  const hits = fields.data?.hits ?? [];
  if (fields.isLoading || hits.length === 0) return null;
  return (
    <Panel title={`Calculated fields (${hits.length})`}>
      <Stack spacing={1}>
        {hits.map((hit) => (
          <Box key={hit.entityId}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {hit.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontFamily: 'monospace', wordBreak: 'break-word' }}
            >
              {hit.summary}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Panel>
  );
}

function GovernancePanel({ datasetId }: { datasetId: string }) {
  const status = useSmusStatus();
  const configured = Boolean(status.data?.configured);
  const links = useSmusDatasetLinks([datasetId], configured);
  if (!configured) return null;
  const link = links.data?.get(datasetId);
  return (
    <Panel title="Governance">
      {links.isLoading ? (
        <CircularProgress size={20} />
      ) : link?.linked ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <SmusLinkBadge link={link} />
          <Typography variant="body2">
            Governed by SMUS listing{' '}
            {link.url ? (
              <Link href={link.url} target="_blank" rel="noopener noreferrer">
                {link.listingName ?? link.listingId}
              </Link>
            ) : (
              (link.listingName ?? link.listingId)
            )}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No SMUS listing matches what it reads. Pointing it at a published listing’s table makes it
          governed.
        </Typography>
      )}
    </Panel>
  );
}

export function DatasetEditor({
  dataset,
  onClose,
  onOpen,
}: {
  dataset: { id: string; name: string };
  onClose: () => void;
  /** Open a dashboard or analysis that reads it. */
  onOpen: (source: RebindSource) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [confirming, setConfirming] = useState(false);
  const draft = useDatasetSourceDraft(dataset.id, {
    onSaved: (name) => {
      enqueueSnackbar(`Saved ${name}`, { variant: 'success' });
      announceAssetChanges(['dataset']);
    },
  });
  const readers = useRelated(dataset.id, 'uses-dataset', ['dashboard', 'analysis']);
  const readerCount = readers.data?.hits.length ?? 0;
  const consoleUrl = getQuickSightConsoleUrl('dataset', dataset.id);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
        <Tooltip title="Back to the list">
          <IconButton onClick={onClose} aria-label="Back to the list">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
              {draft.name || dataset.name}
            </Typography>
            <Chip size="small" variant="outlined" label="Dataset" />
            {draft.importMode && <Chip size="small" variant="outlined" label={draft.importMode} />}
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {dataset.id}
            {consoleUrl && (
              <>
                {' · '}
                <Link href={consoleUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                  QuickSight <OpenInNew sx={{ fontSize: 12, verticalAlign: 'text-top' }} />
                </Link>
              </>
            )}
          </Typography>
        </Box>
        <Button
          startIcon={<Undo />}
          onClick={draft.reset}
          disabled={!draft.hasChanges || draft.saving}
        >
          Undo
        </Button>
        <Button
          variant="contained"
          startIcon={draft.saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={() => setConfirming(true)}
          disabled={!draft.hasChanges || draft.saving}
        >
          Save
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Panel
          title="Where it reads from"
          description="Change the data source, table or query. Every column stays as it is; if the new source does not produce them, QuickSight refuses and says so."
        >
          {draft.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : draft.loadError ? (
            <Alert severity="error">
              <AlertTitle>Cannot edit this dataset</AlertTitle>
              {draft.loadError}
            </Alert>
          ) : (
            <Stack spacing={2}>
              <TextField
                label="Name"
                size="small"
                value={draft.name}
                onChange={(e) => draft.setName(e.target.value)}
                disabled={draft.saving}
                sx={{ maxWidth: 480 }}
              />
              <DatasetSourceTables draft={draft} />
              {draft.saveError && (
                <Alert severity="error">
                  <AlertTitle>QuickSight rejected the change</AlertTitle>
                  {draft.saveError}
                </Alert>
              )}
            </Stack>
          )}
        </Panel>

        <Stack spacing={2}>
          <ReadersPanel datasetId={dataset.id} onOpen={onOpen} />
          <GovernancePanel datasetId={dataset.id} />
          <CalculatedFieldsPanel datasetId={dataset.id} />
        </Stack>
      </Box>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save {draft.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {draft.changes.map((change) => (
                <li key={change}>
                  <Typography variant="body2">{change}</Typography>
                </li>
              ))}
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {readerCount
                ? `${readerCount} dashboard${readerCount === 1 ? '' : 's'} and analyses read it. Its columns are kept, so they keep working; a SPICE dataset shows the new source after its next refresh.`
                : 'Nothing reads it yet.'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirming(false);
              void draft.save();
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
