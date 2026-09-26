/**
 * A job's log as a grid: virtualised, so a long export scrolls smoothly;
 * filtered by level (with counts) and by text across message and asset;
 * following the newest line while the job runs. Click a line for its
 * structured details. The log is data (level, asset, API calls), so it is
 * filtered as data rather than searched as text.
 */
import {
  BugReportOutlined,
  ErrorOutlineOutlined,
  InfoOutlined,
  Search,
  VerticalAlignBottom,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef, useGridApiRef } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import type { JobLog } from '@/shared/api/modules/jobs';
import { EmptyState, pal } from '@/shared/design-system';
import type { AssetHueKey } from '@/shared/design-system/tokens';

type Level = JobLog['level'];

const LEVELS: ReadonlyArray<{ value: Level; label: string; icon: ReactNode }> = [
  {
    value: 'error',
    label: 'Errors',
    icon: <ErrorOutlineOutlined fontSize="inherit" color="error" />,
  },
  {
    value: 'warn',
    label: 'Warnings',
    icon: <WarningAmberOutlined fontSize="inherit" color="warning" />,
  },
  { value: 'info', label: 'Info', icon: <InfoOutlined fontSize="inherit" color="info" /> },
  {
    value: 'debug',
    label: 'Debug',
    icon: <BugReportOutlined fontSize="inherit" color="disabled" />,
  },
];

/** Debug is noise until asked for. */
const DEFAULT_LEVELS: Level[] = ['error', 'warn', 'info'];
const DEFAULT_HEIGHT = 420;
const ROW_HEIGHT = 32;
const ASSET_HUES = new Set<string>([
  'dashboard',
  'analysis',
  'dataset',
  'datasource',
  'folder',
  'user',
  'group',
]);

interface LogRow {
  id: number;
  ts: number;
  level: Level;
  message: string;
  assetType?: string;
  assetId?: string;
  apiCalls?: number;
  details?: Record<string, unknown>;
}

function toRows(logs: JobLog[]): LogRow[] {
  return logs.map((log, id) => {
    const details = log.details ?? undefined;
    const pick = (key: string) =>
      typeof details?.[key] === 'string' ? (details[key] as string) : undefined;
    const calls = details?.apiCalls;
    return {
      id,
      ts: Date.parse(log.timestamp),
      level: log.level,
      message: log.message,
      assetType: pick('assetType'),
      assetId: pick('assetId'),
      apiCalls: typeof calls === 'number' ? calls : undefined,
      details: details && Object.keys(details).length > 0 ? details : undefined,
    };
  });
}

function matches(row: LogRow, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  return [row.message, row.assetType, row.assetId].some((v) => v?.toLowerCase().includes(needle));
}

const COLUMNS: GridColDef<LogRow>[] = [
  {
    field: 'ts',
    headerName: 'Time',
    width: 110,
    renderCell: ({ row }) =>
      Number.isFinite(row.ts) ? (
        <Tooltip title={format(row.ts, 'PPpp')}>
          <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {format(row.ts, 'HH:mm:ss.SSS')}
          </Box>
        </Tooltip>
      ) : (
        '-'
      ),
  },
  {
    field: 'level',
    headerName: '',
    width: 36,
    sortable: false,
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', fontSize: 16 }}>
        {LEVELS.find((l) => l.value === row.level)?.icon}
      </Box>
    ),
  },
  {
    field: 'message',
    headerName: 'Message',
    flex: 1,
    minWidth: 240,
    renderCell: ({ row }) => (
      <Box
        component="span"
        sx={{
          fontSize: '0.8125rem',
          color:
            row.level === 'error'
              ? 'error.main'
              : row.level === 'debug'
                ? 'text.secondary'
                : undefined,
        }}
      >
        {row.message}
      </Box>
    ),
  },
  {
    field: 'assetType',
    headerName: 'Asset',
    width: 200,
    renderCell: ({ row }) =>
      row.assetType ? (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', height: '100%', minWidth: 0 }}
        >
          <Chip
            size="small"
            label={row.assetType}
            sx={(theme) =>
              ASSET_HUES.has(row.assetType!)
                ? {
                    height: 20,
                    fontSize: '0.6875rem',
                    color: pal(theme).asset[row.assetType as AssetHueKey].strong,
                    bgcolor: pal(theme).asset[row.assetType as AssetHueKey].subtle,
                  }
                : { height: 20, fontSize: '0.6875rem' }
            }
          />
          {row.assetId && (
            <Typography
              variant="caption"
              noWrap
              sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
            >
              {row.assetId}
            </Typography>
          )}
        </Stack>
      ) : null,
  },
  {
    field: 'apiCalls',
    headerName: 'Calls',
    width: 70,
    type: 'number',
  },
];

interface JobLogGridProps {
  logs: JobLog[];
  loading?: boolean;
  error?: string | null;
  /** The job is running: keep the newest line in view until the reader scrolls a filter. */
  follow?: boolean;
  height?: number;
}

export function JobLogGrid({
  logs,
  loading = false,
  error = null,
  follow = false,
  height = DEFAULT_HEIGHT,
}: JobLogGridProps) {
  const apiRef = useGridApiRef();
  const [levels, setLevels] = useState<Level[]>(DEFAULT_LEVELS);
  const [text, setText] = useState('');
  const [stick, setStick] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const rows = useMemo(() => toRows(logs), [logs]);
  const counts = useMemo(() => {
    const out: Record<Level, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    for (const row of rows) out[row.level] += 1;
    return out;
  }, [rows]);
  const shown = useMemo(
    () => rows.filter((row) => levels.includes(row.level) && matches(row, text)),
    [rows, levels, text]
  );
  const detail = selected === null ? null : (rows[selected] ?? null);

  // Following: keep the newest line in view as lines arrive.
  useEffect(() => {
    if (follow && stick && shown.length > 0) {
      apiRef.current?.scrollToIndexes({ rowIndex: shown.length - 1 });
    }
  }, [follow, stick, shown.length, apiRef]);

  if (error && logs.length === 0) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!loading && logs.length === 0) {
    return (
      <EmptyState
        compact
        title="No log lines yet"
        description={
          follow
            ? 'The worker has not written anything yet; this follows it as it does.'
            : 'This job wrote no log.'
        }
      />
    );
  }

  return (
    <Stack spacing={1} data-testid="job-log">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <ToggleButtonGroup
          size="small"
          value={levels}
          onChange={(_, next: Level[]) => setLevels(next)}
          aria-label="Levels shown"
        >
          {LEVELS.map((level) => (
            <ToggleButton key={level.value} value={level.value} sx={{ gap: 0.5, px: 1.25 }}>
              {level.icon}
              {level.label}
              <Box
                component="span"
                sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
              >
                {counts[level.value]}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Filter by message or asset"
          value={text}
          onChange={(e) => setText(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {follow && (
          <Tooltip title={stick ? 'Following the newest line' : 'Follow the newest line'}>
            <ToggleButton
              size="small"
              value="follow"
              selected={stick}
              onChange={() => setStick((s) => !s)}
              aria-label="Follow the newest line"
            >
              <VerticalAlignBottom fontSize="small" />
            </ToggleButton>
          </Tooltip>
        )}
      </Stack>
      {error && <Alert severity="warning">{error}</Alert>}
      <Box
        sx={(theme) => ({
          height,
          '& .MuiDataGrid-root': { border: `1px solid ${pal(theme).line.divider}` },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        })}
      >
        <DataGrid<LogRow>
          apiRef={apiRef}
          rows={shown}
          columns={COLUMNS}
          loading={loading}
          rowHeight={ROW_HEIGHT}
          columnHeaderHeight={36}
          density="compact"
          disableColumnMenu
          hideFooter
          onRowClick={({ row }) => setSelected(row.id === selected ? null : row.id)}
          getRowClassName={({ row }) => (row.id === selected ? 'Mui-selected' : '')}
          aria-label="Job log"
        />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {shown.length === rows.length
          ? `${rows.length} lines`
          : `${shown.length} of ${rows.length} lines`}
        {detail?.details ? '' : ' · click a line for its details'}
      </Typography>
      {detail?.details && (
        <Box
          component="pre"
          data-testid="job-log-details"
          sx={(theme) => ({
            m: 0,
            p: 1.5,
            maxHeight: 220,
            overflow: 'auto',
            fontSize: '0.75rem',
            borderRadius: `${theme.shape.borderRadius}px`,
            bgcolor: pal(theme).surface.container,
            border: `1px solid ${pal(theme).line.divider}`,
          })}
        >
          {JSON.stringify(detail.details, null, 2)}
        </Box>
      )}
    </Stack>
  );
}
