/**
 * The calculated fields grid: one row per distinct expression, on the same
 * grid the asset pages use. Every column sorts and resizes; the counts are
 * the asset pages' typed chips and open the list behind them; the variants
 * count opens the expressions side by side.
 */
import { CollectionsBookmark, Notes } from '@mui/icons-material';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridColumnGroupingModel,
  type GridColumnVisibilityModel,
} from '@mui/x-data-grid';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { CalculatedFieldRef, CalculatedFieldSummary } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';
import { AssetListDialog, type AssetListItem, TypedChip } from '@/shared/ui';

import { describeSmusTie } from '../../model/fieldCatalog';
import { assetPath } from './assetPath';
import { VariantsDialog } from './VariantsDialog';

interface CalculatedFieldsTableProps {
  items: CalculatedFieldSummary[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  /** Narrow mode when a detail pane is open: name, expression and variants only. */
  compact?: boolean;
}

type Row = CalculatedFieldSummary;

const PAGE_SIZE = 50;
// Explicit heights, no density prop: density scales both, and the grid's
// height is computed from these.
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 36;
const FOOTER_HEIGHT = 53;
const COUNT_WIDTH = 104;

/** What a count opens: the title, the line under it, and the assets. */
interface ListBehindCount {
  title: string;
  description: string;
  assets: AssetListItem[];
}

function definedIn(row: Row, type: 'dashboard' | 'analysis'): CalculatedFieldRef[] {
  return row.definedIn.filter((ref) => ref.type === type);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** A typed count that opens its list; a muted zero when there is nothing behind it. */
function CountChip({
  type,
  count,
  onOpen,
}: {
  type: 'DASHBOARD' | 'ANALYSIS' | 'DATASET';
  count: number;
  onOpen: () => void;
}) {
  if (count === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
        0
      </Typography>
    );
  }
  return (
    <TypedChip
      type={type}
      count={count}
      showIcon={false}
      size="small"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    />
  );
}

function NameCell({ row }: { row: Row }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
        {row.name}
      </Typography>
      {row.template && (
        <Tooltip title="In the template library">
          <CollectionsBookmark
            fontSize="inherit"
            sx={(theme) => ({ color: pal(theme).brand.primary, flexShrink: 0 })}
          />
        </Tooltip>
      )}
      {row.hasNote && (
        <Tooltip title="Has a portal note">
          <Notes fontSize="inherit" sx={{ color: 'text.secondary', flexShrink: 0 }} />
        </Tooltip>
      )}
    </Stack>
  );
}

function ExpressionCell({ expression }: { expression: string }) {
  return (
    <Tooltip title={expression} enterDelay={600}>
      <Typography
        variant="body2"
        component="code"
        noWrap
        sx={{ fontFamily: 'monospace', display: 'block', minWidth: 0 }}
      >
        {expression}
      </Typography>
    </Tooltip>
  );
}

/** A plain count, muted at zero. */
function Count({ value }: { value: number }) {
  return (
    <Typography variant="body2" sx={{ color: value === 0 ? 'text.disabled' : 'text.primary' }}>
      {value}
    </Typography>
  );
}

const COLUMN_GROUPS: GridColumnGroupingModel = [
  {
    groupId: 'definedIn',
    headerName: 'Defined in',
    children: [
      { field: 'definedInDashboards' },
      { field: 'definedInAnalyses' },
      { field: 'datasets' },
    ],
  },
  {
    groupId: 'usedBy',
    headerName: 'Used by',
    children: [
      { field: 'usedByDashboards' },
      { field: 'usedByAnalyses' },
      { field: 'usedByVisuals' },
    ],
  },
];

/** The columns a narrow grid (detail pane open) keeps. */
const COMPACT_COLUMNS: GridColumnVisibilityModel = {
  dataType: false,
  definedInDashboards: false,
  definedInAnalyses: false,
  datasets: false,
  usedByDashboards: false,
  usedByAnalyses: false,
  usedByVisuals: false,
  reads: false,
};

export function CalculatedFieldsTable({
  items,
  selectedKey,
  onSelect,
  compact = false,
}: CalculatedFieldsTableProps) {
  const navigate = useNavigate();
  const [list, setList] = useState<ListBehindCount | null>(null);
  const [variantsOf, setVariantsOf] = useState<string | undefined>();

  const columns = useMemo<GridColDef<Row>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 180,
        renderCell: ({ row }) => <NameCell row={row} />,
      },
      {
        field: 'dataType',
        headerName: 'Type',
        width: 96,
        valueGetter: (_value, row) => row.dataType?.toLowerCase() ?? '',
      },
      {
        field: 'expression',
        headerName: 'Expression',
        flex: 1.6,
        minWidth: 220,
        renderCell: ({ row }) => <ExpressionCell expression={row.expression} />,
      },
      {
        field: 'definedInDashboards',
        headerName: 'Dashboards',
        description: 'Dashboards that define this expression',
        width: COUNT_WIDTH,
        type: 'number',
        valueGetter: (_value, row) => definedIn(row, 'dashboard').length,
        renderCell: ({ row, value }) => (
          <CountChip
            type="DASHBOARD"
            count={value as number}
            onOpen={() =>
              setList({
                title: `Defined in ${plural(value as number, 'dashboard')}`,
                description: row.name,
                assets: definedIn(row, 'dashboard'),
              })
            }
          />
        ),
      },
      {
        field: 'definedInAnalyses',
        headerName: 'Analyses',
        description: 'Analyses that define this expression',
        width: COUNT_WIDTH,
        type: 'number',
        valueGetter: (_value, row) => definedIn(row, 'analysis').length,
        renderCell: ({ row, value }) => (
          <CountChip
            type="ANALYSIS"
            count={value as number}
            onOpen={() =>
              setList({
                title: `Defined in ${plural(value as number, 'analysis').replace('analysiss', 'analyses')}`,
                description: row.name,
                assets: definedIn(row, 'analysis'),
              })
            }
          />
        ),
      },
      {
        field: 'datasets',
        headerName: 'Datasets',
        description:
          'Datasets it is declared on, or bound to when defined in a dashboard or analysis',
        width: COUNT_WIDTH,
        type: 'number',
        valueGetter: (_value, row) => row.datasets.length,
        renderCell: ({ row, value }) => (
          <CountChip
            type="DATASET"
            count={value as number}
            onOpen={() =>
              setList({
                title: plural(value as number, 'dataset'),
                description: `${row.name} · declared on, or bound to`,
                assets: row.datasets.map((dataset) => ({
                  id: dataset.id,
                  name: dataset.name,
                  type: 'dataset',
                  hint: describeSmusTie(dataset),
                })),
              })
            }
          />
        ),
      },
      {
        field: 'variants',
        headerName: 'Variants',
        description: 'Other expressions carrying the same name',
        width: COUNT_WIDTH,
        type: 'number',
        valueGetter: (_value, row) => (row.conflict ? row.conflict.variants + 1 : 0),
        renderCell: ({ row, value }) =>
          (value as number) > 0 ? (
            <Chip
              size="small"
              color="warning"
              label={value as number}
              onClick={(event) => {
                event.stopPropagation();
                setVariantsOf(row.key);
              }}
            />
          ) : null,
      },
      {
        field: 'usedByDashboards',
        headerName: 'Dashboards',
        description: 'Dashboards with a visual that uses it',
        width: COUNT_WIDTH,
        type: 'number',
        valueGetter: (_value, row) => row.usedBy.dashboards,
        renderCell: ({ value }) => <Count value={value as number} />,
      },
      {
        field: 'usedByAnalyses',
        headerName: 'Analyses',
        description: 'Analyses with a visual that uses it',
        width: COUNT_WIDTH,
        type: 'number',
        valueGetter: (_value, row) => row.usedBy.analyses,
        renderCell: ({ value }) => <Count value={value as number} />,
      },
      {
        field: 'usedByVisuals',
        headerName: 'Visuals',
        description: 'Visuals that use it',
        width: 88,
        type: 'number',
        valueGetter: (_value, row) => row.usedBy.visuals,
        renderCell: ({ value }) => <Count value={value as number} />,
      },
      {
        field: 'reads',
        headerName: 'Reads',
        description: 'Fields the expression reads',
        width: 80,
        type: 'number',
        valueGetter: (_value, row) => row.references.length,
        renderCell: ({ value }) => <Count value={value as number} />,
      },
    ],
    []
  );

  const paged = items.length > PAGE_SIZE;
  const headerRows = compact ? 1 : 2;
  const height =
    headerRows * HEADER_HEIGHT +
    Math.max(1, Math.min(items.length, PAGE_SIZE)) * ROW_HEIGHT +
    (paged ? FOOTER_HEIGHT : 0);

  return (
    <Box
      sx={{
        height,
        '& .MuiDataGrid-row': { cursor: 'pointer' },
        '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
        '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
      }}
    >
      <DataGrid<Row>
        rows={items}
        columns={columns}
        columnGroupingModel={COLUMN_GROUPS}
        columnVisibilityModel={compact ? COMPACT_COLUMNS : undefined}
        getRowId={(row) => row.key}
        rowHeight={ROW_HEIGHT}
        columnHeaderHeight={HEADER_HEIGHT}
        disableRowSelectionOnClick
        onRowClick={({ id }) => onSelect(String(id))}
        getRowClassName={({ id }) => (id === selectedKey ? 'Mui-selected' : '')}
        hideFooter={!paged}
        pageSizeOptions={[PAGE_SIZE]}
        initialState={{
          sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
          pagination: { paginationModel: { pageSize: PAGE_SIZE } },
        }}
        aria-label="Calculated fields"
      />
      <AssetListDialog
        open={list !== null}
        onClose={() => setList(null)}
        title={list?.title ?? ''}
        description={list?.description}
        assets={list?.assets ?? []}
        onAssetClick={(asset) => {
          setList(null);
          navigate(assetPath(asset));
        }}
      />
      <VariantsDialog
        fieldKey={variantsOf}
        onClose={() => setVariantsOf(undefined)}
        onOpenField={onSelect}
      />
    </Box>
  );
}
