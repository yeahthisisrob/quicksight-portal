/**
 * The Editor: open a dashboard or analysis, see it drawn, and work on it by
 * function - its issues and their fixes, the selected visual, the edits so
 * far, the datasets it reads and how it is used - then save over it or as a
 * copy. No steps: every panel is one click away the whole time.
 */
import {
  ArrowBack,
  Inventory2Outlined,
  RestoreOutlined,
  Save,
  Star,
  StarBorder,
  Undo,
} from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useState } from 'react';

import { TabBar } from '@/shared/design-system';

import { outlineFromModel } from '../../lib/ops';
import { compactNumber } from '../../lib/ranking';
import type { StudioPanel } from '../../model/studio';
import type { Studio } from '../../model/useStudio';
import { ChangesList } from '../ChangesList';
import { Inspector } from '../mockup/Inspector';
import { OpsList } from '../mockup/OpsList';
import { Panel } from '../primitives/Panel';
import { AssetBrowser } from './AssetBrowser';
import { Canvas, type CanvasView } from './Canvas';
import { DataPanel } from './DataPanel';
import { IssuesPanel } from './IssuesPanel';
import { SaveDialog } from './SaveDialog';
import { SourceRestorePanel } from './SourceRestorePanel';

const SIDE_WIDTH = 420;

function ChangesPanel({ studio }: { studio: Studio }) {
  const sourceOutline = useMemo(
    () => (studio.source.model ? outlineFromModel(studio.source.model) : null),
    [studio.source.model]
  );
  const { ops } = studio.state;
  return (
    <Stack spacing={2.5} data-testid="changes-panel">
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
            Your edits
          </Typography>
          <Button size="small" onClick={studio.clearOps} disabled={ops.length === 0}>
            Clear all
          </Button>
        </Stack>
        <OpsList ops={ops} outline={sourceOutline} onRemove={studio.removeOp} />
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          What a save writes
        </Typography>
        <ChangesList
          changes={studio.preview.changes}
          emptyText={
            studio.preview.loading
              ? 'Working out the changes…'
              : 'Nothing yet. Edit a visual or accept a fix.'
          }
        />
      </Box>
    </Stack>
  );
}

function SidePanel({ studio, sheetId }: { studio: Studio; sheetId: string }) {
  const { state, repair, preview, source } = studio;
  const sourceOutline = useMemo(
    () => (source.model ? outlineFromModel(source.model) : []),
    [source.model]
  );
  const outline = preview.outline ?? sourceOutline;
  const ungoverned = studio.data.datasets.filter((d) => d.smus && !d.smus.linked).length;
  const tabs: Array<{ value: StudioPanel; label: string; badge?: number }> = [
    { value: 'issues', label: 'Issues', badge: repair.summary.total || undefined },
    { value: 'inspect', label: 'Inspect' },
    { value: 'changes', label: 'Changes', badge: state.ops.length || undefined },
    { value: 'data', label: 'Data', badge: ungoverned || undefined },
  ];

  return (
    <Panel flush sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
      <Box sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TabBar<StudioPanel>
          tabs={tabs}
          value={state.panel}
          onChange={studio.setPanel}
          ariaLabel="Editor panels"
        />
      </Box>
      <Box sx={{ p: 2, maxHeight: { lg: 'calc(100vh - 220px)' }, overflow: 'auto' }}>
        {state.panel === 'issues' && <IssuesPanel studio={studio} />}
        {state.panel === 'inspect' &&
          (outline.length > 0 ? (
            <Inspector
              outline={outline}
              sheetId={sheetId}
              selected={state.selectedElement}
              onOps={studio.addOps}
              onClearSelection={() => studio.selectElement(null)}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nothing to inspect until the definition is cached.
            </Typography>
          ))}
        {state.panel === 'changes' && <ChangesPanel studio={studio} />}
        {state.panel === 'data' && <DataPanel studio={studio} />}
      </Box>
    </Panel>
  );
}

function EditorHeader({ studio, onSave }: { studio: Studio; onSave: () => void }) {
  const source = studio.state.source!;
  const views = studio.insights.data?.views;
  const archived = studio.archived;
  const archivedAt = archived?.archivedAt ? Date.parse(archived.archivedAt) : Number.NaN;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}
    >
      <Tooltip title="Open something else">
        <IconButton onClick={() => studio.open(null)} aria-label="All assets">
          <ArrowBack />
        </IconButton>
      </Tooltip>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }} noWrap>
            {source.name}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={source.type === 'dashboard' ? 'Dashboard' : 'Analysis'}
          />
          {archived && (
            <Chip size="small" color="warning" icon={<Inventory2Outlined />} label="Archived" />
          )}
          {!archived && (
            <Tooltip
              title={
                studio.source.isTemplate
                  ? 'A layout template; click to unmark'
                  : 'Mark as a layout template, listed under Templates'
              }
            >
              <IconButton
                size="small"
                onClick={() => void studio.setTemplate(!studio.source.isTemplate)}
                aria-label={studio.source.isTemplate ? 'Unmark as template' : 'Mark as template'}
              >
                {studio.source.isTemplate ? (
                  <Star fontSize="small" sx={{ color: 'warning.main' }} />
                ) : (
                  <StarBorder fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
          {source.id}
          {archived
            ? ` · archived${Number.isFinite(archivedAt) ? ` ${formatDistanceToNow(archivedAt, { addSuffix: true })}` : ''}${archived.archivedBy ? ` by ${archived.archivedBy}` : ''}${archived.archiveReason ? ` · ${archived.archiveReason}` : ''}`
            : views
              ? ` · ${compactNumber(views.last30d)} views in 30 days · ${compactNumber(views.uniqueViewers)} viewers`
              : ''}
        </Typography>
      </Box>
      <Button startIcon={<Undo />} onClick={studio.undoOp} disabled={studio.state.ops.length === 0}>
        Undo
      </Button>
      <Button
        variant="contained"
        startIcon={archived ? <RestoreOutlined /> : <Save />}
        onClick={onSave}
        disabled={!studio.dirty}
      >
        {archived ? 'Restore' : 'Save'}
      </Button>
    </Stack>
  );
}

export function Editor({ studio }: { studio: Studio }) {
  const [view, setView] = useState<CanvasView>('after');
  const [sheetId, setSheetId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const { source, preview } = studio;

  const firstSheet = preview.outline?.[0]?.sheetId ?? source.model?.sheets[0]?.id ?? '';
  const currentSheetId = sheetId ?? firstSheet;

  if (studio.archivedData) {
    const pick = studio.archivedData;
    const type = pick.type === 'dataset' || pick.type === 'datasource' ? pick.type : null;
    if (type) {
      return <SourceRestorePanel pick={{ ...pick, type }} onClose={() => studio.open(null)} />;
    }
  }
  if (!studio.state.source) {
    return <AssetBrowser onOpen={studio.open} onOpenArchived={studio.openArchived} />;
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      <EditorHeader studio={studio} onSave={() => setSaving(true)} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: `minmax(0, 1fr) ${SIDE_WIDTH}px` },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Panel>
          <Canvas
            studio={studio}
            view={view}
            onViewChange={setView}
            sheetId={currentSheetId}
            onSheetChange={setSheetId}
          />
        </Panel>
        <SidePanel studio={studio} sheetId={currentSheetId} />
      </Box>
      <SaveDialog studio={studio} open={saving} onClose={() => setSaving(false)} />
    </Box>
  );
}
