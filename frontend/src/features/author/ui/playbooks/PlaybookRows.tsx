/**
 * A preview's or run's rows: one per asset, what was found or done, and why.
 * Count chips across the top filter the grid. In a preview the rows to
 * change are ticked, and unticking one keeps it out of the run; rows left
 * for review link to the Studio, where they can be fixed by hand.
 */
import { OpenInNew } from '@mui/icons-material';
import { Box, Chip, Link, Stack, Tooltip, Typography } from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridRowId,
  type GridRowSelectionModel,
} from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import type {
  PlaybookItem,
  PlaybookItemCounts,
  PlaybookItemsPage,
} from '@/shared/api/modules/playbooks';
import { isRowSelected, selectionOf } from '@/shared/lib/gridSelection';
import { assetIcons } from '@/shared/ui/icons';

type Mode = 'preview' | 'run';
type Filter = 'all' | 'change' | 'review' | 'skip' | 'failed' | 'done' | 'pending';

const GRID_HEIGHT = 520;
const ROW_HEIGHT = 64;

const OUTCOME: Record<
  string,
  { label: string; color: 'success' | 'warning' | 'default' | 'error' | 'info' | 'primary' }
> = {
  change: { label: 'To change', color: 'primary' },
  review: { label: 'For review', color: 'warning' },
  skip: { label: 'Skipped', color: 'default' },
  failed: { label: 'Failed', color: 'error' },
  done: { label: 'Changed', color: 'success' },
  pending: { label: 'Waiting', color: 'info' },
};

/** What a row came to, as one of the filter keys. */
function outcomeOf(row: PlaybookItem, mode: Mode): Exclude<Filter, 'all'> {
  if (row.status === 'failed') return 'failed';
  if (row.status === 'pending') return 'pending';
  if (mode === 'run') {
    if (row.status === 'done') return 'done';
    if (row.status === 'review') return 'review';
    return 'skip';
  }
  return (row.verdict ?? 'skip') as 'change' | 'review' | 'skip';
}

function filtersFor(mode: Mode, counts: PlaybookItemCounts): Array<[Filter, number]> {
  const preview: Array<[Filter, number]> = [
    ['change', counts.verdicts.change],
    ['review', counts.verdicts.review],
    ['skip', counts.verdicts.skip],
    ['failed', counts.failed],
    ['pending', counts.pending],
  ];
  const run: Array<[Filter, number]> = [
    ['done', counts.done],
    ['failed', counts.failed],
    ['review', counts.review],
    ['skip', counts.skipped],
    ['pending', counts.pending],
  ];
  return [['all', counts.total], ...(mode === 'preview' ? preview : run).filter(([, n]) => n > 0)];
}

/** Where a person fixes this asset by hand. */
function studioLink(row: PlaybookItem): string {
  const params = new URLSearchParams({
    tab: 'studio',
    type: row.assetType,
    id: row.assetId,
    name: row.name,
  });
  return `/author?${params.toString()}`;
}

function AssetCell({ row }: { row: PlaybookItem }) {
  const Icon = assetIcons[row.assetType as keyof typeof assetIcons];
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%', minWidth: 0 }}>
      {Icon && <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {row.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
          {row.assetType} · {row.assetId}
        </Typography>
      </Box>
    </Stack>
  );
}

function ChangesCell({ row }: { row: PlaybookItem }) {
  const changes = row.changes ?? [];
  const detail = row.error ?? row.summary ?? '';
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        minWidth: 0,
      }}
    >
      <Typography
        variant="body2"
        noWrap
        title={detail}
        sx={{ color: row.status === 'failed' ? 'error.main' : 'text.primary' }}
      >
        {detail}
      </Typography>
      {changes.length > 0 && (
        <Tooltip
          title={
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </Box>
          }
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {changes[0]}
            {changes.length > 1 ? ` and ${changes.length - 1} more` : ''}
          </Typography>
        </Tooltip>
      )}
      {row.warnings?.length ? (
        <Typography
          variant="caption"
          sx={{ color: 'warning.main' }}
          noWrap
          title={row.warnings.join('\n')}
        >
          {row.warnings[0]}
        </Typography>
      ) : null}
    </Box>
  );
}

export function PlaybookRows({
  page,
  mode,
  selected,
  onSelected,
  loading = false,
}: {
  page: PlaybookItemsPage | null;
  mode: Mode;
  /** Preview only: the rows to change that are ticked. */
  selected?: Set<string>;
  onSelected?: (keys: Set<string>) => void;
  loading?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>(mode === 'preview' ? 'change' : 'all');
  const rows = page?.items ?? [];
  const counts = page?.counts;
  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => outcomeOf(r, mode) === filter)),
    [rows, filter, mode]
  );
  const selectable = mode === 'preview' && Boolean(onSelected);

  const columns: GridColDef<PlaybookItem>[] = [
    {
      field: 'name',
      headerName: 'Asset',
      flex: 1,
      minWidth: 220,
      renderCell: ({ row }) => <AssetCell row={row} />,
    },
    {
      field: 'outcome',
      headerName: mode === 'preview' ? 'Found' : 'Result',
      width: 130,
      valueGetter: (_v, row) => OUTCOME[outcomeOf(row, mode)]?.label,
      renderCell: ({ row }) => {
        const outcome = OUTCOME[outcomeOf(row, mode)]!;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              size="small"
              color={outcome.color}
              variant={row.status === 'pending' ? 'outlined' : 'filled'}
              label={outcome.label}
            />
          </Box>
        );
      },
    },
    {
      field: 'summary',
      headerName: mode === 'preview' ? 'Why' : 'What happened',
      flex: 2,
      minWidth: 280,
      sortable: false,
      renderCell: ({ row }) => <ChangesCell row={row} />,
    },
    {
      field: 'open',
      headerName: '',
      width: 130,
      sortable: false,
      renderCell: ({ row }) =>
        outcomeOf(row, mode) === 'review' || row.status === 'failed' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Link component={RouterLink} to={studioLink(row)} underline="hover" variant="body2">
              Open in Studio <OpenInNew sx={{ fontSize: 14, verticalAlign: 'text-bottom' }} />
            </Link>
          </Box>
        ) : null,
    },
  ];

  const model: GridRowSelectionModel = selectionOf(selected ?? []);
  const onModel = (next: GridRowSelectionModel) => {
    if (!onSelected) return;
    // Rows hidden by the filter keep their ticks.
    const visible = new Set<GridRowId>(shown.map((r) => r.key));
    const keep = [...(selected ?? [])].filter((key) => !visible.has(key));
    const ticked = shown
      .filter((r) => r.verdict === 'change' && isRowSelected(next, r.key))
      .map((r) => r.key);
    onSelected(new Set([...keep, ...ticked]));
  };

  return (
    <Stack spacing={1.5}>
      {counts && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: 'wrap', gap: 1 }}
          role="group"
          aria-label="Show"
        >
          {filtersFor(mode, counts).map(([key, n]) => (
            <Chip
              key={key}
              label={`${key === 'all' ? 'All' : OUTCOME[key]!.label} ${n}`}
              color={key === 'all' ? 'default' : OUTCOME[key]!.color}
              variant={filter === key ? 'filled' : 'outlined'}
              onClick={() => setFilter(key)}
              data-filter={key}
            />
          ))}
        </Stack>
      )}
      <Box sx={{ height: GRID_HEIGHT }}>
        <DataGrid
          rows={shown}
          columns={columns}
          getRowId={(r) => r.key}
          loading={loading}
          rowHeight={ROW_HEIGHT}
          checkboxSelection={selectable}
          isRowSelectable={({ row }) => row.verdict === 'change'}
          rowSelectionModel={model}
          onRowSelectionModelChange={onModel}
          disableRowSelectionOnClick
          disableColumnMenu
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          localeText={{
            noRowsLabel: mode === 'preview' ? 'Nothing in scope' : 'No rows yet',
          }}
        />
      </Box>
    </Stack>
  );
}
