/**
 * Where a calculated field is used.
 *
 * One row per place it actually appears — a visual, or the asset itself when
 * no visual named it — because the chips this replaced put forty visuals and
 * one dashboard on the same line and stopped being readable at about ten.
 * The grid virtualises, so a field used in a thousand visuals costs the same
 * as one used in three, and the type chips above it are filters, not decoration.
 */
import { Search } from '@mui/icons-material';
import {
  Box,
  Chip,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import type { FieldUsedIn, FieldVisualUsage } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import { type FieldUsageRow, filterUsage, summarizeUsage, usageRows } from '../../model/fieldUsage';
import { assetPath } from './assetPath';

interface FieldUsagePanelProps {
  usedIn: FieldUsedIn[];
  visuals: FieldVisualUsage[];
}

type TypeFilter = 'dashboard' | 'analysis' | undefined;

/** Past this many rows the grid pages rather than scrolling forever. */
const PAGE_SIZE = 25;
/** The grid grows with its rows up to here, then scrolls: no dead space at four rows. */
const MAX_GRID_HEIGHT = 380;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 53;
const SEARCH_FROM = 8;

const columns: GridColDef<FieldUsageRow>[] = [
  {
    field: 'assetName',
    headerName: 'Asset',
    flex: 1.4,
    minWidth: 180,
    renderCell: ({ row }) => (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Chip
          size="small"
          variant="outlined"
          label={row.assetType}
          sx={{ height: 18, '& .MuiChip-label': { px: 0.6, fontSize: 10 } }}
        />
        <Link
          component={RouterLink}
          to={assetPath({ type: row.assetType, id: row.assetId, name: row.assetName })}
          variant="body2"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {row.assetName}
        </Link>
      </Stack>
    ),
  },
  {
    field: 'sheetName',
    headerName: 'Sheet',
    flex: 0.8,
    minWidth: 110,
    renderCell: ({ row }) => (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {row.sheetName || '—'}
      </Typography>
    ),
  },
  {
    field: 'visualName',
    headerName: 'Visual',
    flex: 1,
    minWidth: 130,
    renderCell: ({ row }) =>
      row.inVisual ? (
        <Typography variant="body2" noWrap>
          {row.visualName}
        </Typography>
      ) : (
        <Tooltip title="The asset reads the field, but the export did not name a visual for it">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            not in a visual
          </Typography>
        </Tooltip>
      ),
  },
  {
    field: 'open',
    headerName: '',
    width: 90,
    sortable: false,
    filterable: false,
    renderCell: ({ row }) => {
      const url = getQuickSightConsoleUrl(row.assetType, row.assetId);
      return url ? (
        <Link href={url} target="_blank" rel="noreferrer" variant="caption">
          QuickSight
        </Link>
      ) : null;
    },
  },
];

export function FieldUsagePanel({ usedIn, visuals }: FieldUsagePanelProps) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>(undefined);

  const rows = useMemo(() => usageRows(usedIn, visuals), [usedIn, visuals]);
  const summary = useMemo(() => summarizeUsage(rows), [rows]);
  const shown = useMemo(
    () => filterUsage(type ? rows.filter((r) => r.assetType === type) : rows, search),
    [rows, search, type]
  );

  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No dashboard or analysis reads this field.
      </Typography>
    );
  }

  const toggle = (next: TypeFilter) => setType((current) => (current === next ? undefined : next));
  const paged = shown.length > PAGE_SIZE;
  const height = Math.min(
    MAX_GRID_HEIGHT,
    HEADER_HEIGHT + Math.max(1, shown.length) * ROW_HEIGHT + (paged ? FOOTER_HEIGHT : 0)
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Chip
          size="small"
          label={`${summary.dashboards} dashboards`}
          color={type === 'dashboard' ? 'primary' : 'default'}
          variant={type === 'dashboard' ? 'filled' : 'outlined'}
          onClick={() => toggle('dashboard')}
          disabled={summary.dashboards === 0}
        />
        <Chip
          size="small"
          label={`${summary.analyses} analyses`}
          color={type === 'analysis' ? 'primary' : 'default'}
          variant={type === 'analysis' ? 'filled' : 'outlined'}
          onClick={() => toggle('analysis')}
          disabled={summary.analyses === 0}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {summary.visuals} visuals
          {summary.withoutVisual > 0 ? ` · ${summary.withoutVisual} with no visual named` : ''}
        </Typography>
        {rows.length >= SEARCH_FROM && (
          <TextField
            size="small"
            placeholder="Filter by asset, sheet or visual"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ ml: 'auto', minWidth: 220 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'aria-label': 'Filter where this field is used' },
            }}
          />
        )}
      </Stack>
      <Box
        sx={(theme) => ({
          height,
          '& .MuiDataGrid-root': { border: `1px solid ${pal(theme).line.divider}` },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        })}
      >
        <DataGrid<FieldUsageRow>
          rows={shown}
          columns={columns}
          density="compact"
          disableColumnMenu
          disableRowSelectionOnClick
          hideFooter={!paged}
          initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE, page: 0 } } }}
          pageSizeOptions={[PAGE_SIZE, 50, 100]}
          aria-label="Where this field is used"
        />
      </Box>
    </Stack>
  );
}
