/**
 * A list of assets (where a field is defined, say) that stays one size
 * however many there are: a compact grid that grows with its rows up to a
 * cap, then pages, with a search once there are enough to need one. Chips
 * in a row stopped being readable at about ten.
 */
import { Search } from '@mui/icons-material';
import { Chip, InputAdornment, Link, Stack, TextField } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import type { CalculatedFieldRef } from '@/shared/api/modules/data-catalog';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import { assetPath } from './assetPath';

const PAGE_SIZE = 25;
const MAX_HEIGHT = 320;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 53;
const SEARCH_FROM = 8;

type Row = CalculatedFieldRef & { rowId: string };

const columns: GridColDef<Row>[] = [
  {
    field: 'name',
    headerName: 'Asset',
    flex: 1,
    minWidth: 180,
    renderCell: ({ row }) => (
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', minWidth: 0, height: '100%' }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={row.type}
          sx={{ height: 18, '& .MuiChip-label': { px: 0.6, fontSize: 10 } }}
        />
        <Link
          component={RouterLink}
          to={assetPath(row)}
          variant="body2"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {row.name}
        </Link>
      </Stack>
    ),
  },
  {
    field: 'open',
    headerName: '',
    width: 90,
    sortable: false,
    filterable: false,
    renderCell: ({ row }) => {
      const url = getQuickSightConsoleUrl(row.type, row.id);
      return url ? (
        <Link href={url} target="_blank" rel="noreferrer" variant="caption">
          QuickSight
        </Link>
      ) : null;
    },
  },
];

export function AssetRefGrid({ assets }: { assets: CalculatedFieldRef[] }) {
  const [search, setSearch] = useState('');
  const rows = useMemo<Row[]>(
    () => assets.map((a) => ({ ...a, rowId: `${a.type}:${a.id}` })),
    [assets]
  );
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.type} ${r.name}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const paged = shown.length > PAGE_SIZE;
  const height = Math.min(
    MAX_HEIGHT,
    HEADER_HEIGHT +
      Math.max(1, Math.min(shown.length, PAGE_SIZE)) * ROW_HEIGHT +
      (paged ? FOOTER_HEIGHT : 0)
  );

  return (
    <Stack spacing={1}>
      {rows.length >= SEARCH_FROM && (
        <TextField
          size="small"
          placeholder={`Search ${rows.length} assets`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ maxWidth: 320 }}
        />
      )}
      <DataGrid
        rows={shown}
        columns={columns}
        getRowId={(r) => r.rowId}
        rowHeight={ROW_HEIGHT}
        columnHeaderHeight={HEADER_HEIGHT}
        hideFooter={!paged}
        pageSizeOptions={[PAGE_SIZE]}
        initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE } } }}
        disableRowSelectionOnClick
        disableColumnMenu
        density="compact"
        sx={{ height, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' } }}
      />
    </Stack>
  );
}
