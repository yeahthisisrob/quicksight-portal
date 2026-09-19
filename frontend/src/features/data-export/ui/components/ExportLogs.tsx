import {
  ErrorOutlineOutlined as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material';
import { Box, Chip, Collapse, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';

import { EmptyState, pal } from '@/shared/design-system';
import type { AssetHueKey } from '@/shared/design-system/tokens';

interface ExportLogEntry {
  ts: number;
  msg: string;
  level?: 'info' | 'warn' | 'error';
  assetType?: string;
  assetId?: string;
  apiCalls?: number;
}

interface ExportLogsProps {
  logs: ExportLogEntry[];
  maxHeight?: number;
  showTimestamps?: boolean;
  defaultExpanded?: boolean;
}

const DEFAULT_MAX_HEIGHT = 400;
const TIME_FORMAT = 'MMM dd, HH:mm:ss.SSS';
const MS_PER_S = 1000;
const COLUMN = { icon: 28, time: 160, duration: 72, calls: 80, type: 110 } as const;

const ASSET_HUES: Record<string, AssetHueKey> = {
  dashboard: 'dashboard',
  analysis: 'analysis',
  dataset: 'dataset',
  datasource: 'datasource',
  folder: 'folder',
  user: 'user',
  group: 'group',
};

function LevelIcon({ level }: { level?: string }) {
  switch (level) {
    case 'error':
      return <ErrorIcon fontSize="inherit" color="error" />;
    case 'warn':
      return <WarningIcon fontSize="inherit" color="warning" />;
    default:
      return <InfoIcon fontSize="inherit" color="info" />;
  }
}

function HeaderCell({ width, children }: { width?: number; children?: string }) {
  return (
    <Box sx={{ width, flex: width ? undefined : 1, px: 1, py: 0.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
    </Box>
  );
}

function MonoCell({
  width,
  align,
  children,
}: {
  width?: number;
  align?: 'left' | 'right' | 'center';
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        width,
        flex: width ? undefined : 1,
        px: 1,
        py: 0.5,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        color: 'text.secondary',
        textAlign: align,
        wordBreak: 'break-word',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The worker's log for one export, newest first, filterable by asset type.
 * Rows carry their asset's hue on the left edge so a scan finds a type.
 */
export function ExportLogs({
  logs,
  maxHeight = DEFAULT_MAX_HEIGHT,
  showTimestamps = true,
  defaultExpanded = true,
}: ExportLogsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const availableTypes = useMemo(
    () => [...new Set(logs.map((log) => log.assetType).filter(Boolean) as string[])].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const filtered =
      selectedTypes.length > 0
        ? logs.filter((log) => !log.assetType || selectedTypes.includes(log.assetType))
        : logs;
    return [...filtered].sort((a, b) => b.ts - a.ts);
  }, [logs, selectedTypes]);

  const startTime = useMemo(() => Math.min(...logs.map((l) => l.ts)), [logs]);

  if (logs.length === 0) {
    return (
      <EmptyState
        compact
        title="No log entries"
        description="The worker has not written anything for this job yet."
      />
    );
  }

  const toggleType = (type: string) =>
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2">Log</Typography>
        <Typography variant="caption" color="text.secondary">
          {filteredLogs.length} of {logs.length} entries
        </Typography>
        <Box sx={{ flex: 1 }} />
        {availableTypes.map((type) => {
          const hue = ASSET_HUES[type];
          const selected = selectedTypes.includes(type);
          return (
            <Chip
              key={type}
              label={type}
              size="small"
              variant={selected ? 'filled' : 'outlined'}
              onClick={() => toggleType(type)}
              sx={(theme) =>
                hue && selected
                  ? {
                      bgcolor: pal(theme).asset[hue].subtle,
                      color: pal(theme).asset[hue].strong,
                      border: `1px solid ${pal(theme).asset[hue].main}`,
                    }
                  : {}
              }
            />
          );
        })}
        <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Collapse in={expanded}>
        <Box
          sx={(theme) => ({
            maxHeight,
            overflowY: 'auto',
            border: `1px solid ${pal(theme).line.divider}`,
            borderRadius: `${theme.shape.borderRadius}px`,
          })}
        >
          <Box
            sx={(theme) => ({
              position: 'sticky',
              top: 0,
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: pal(theme).surface.hover,
              borderBottom: `1px solid ${pal(theme).line.divider}`,
            })}
          >
            <HeaderCell width={COLUMN.icon} />
            {showTimestamps && <HeaderCell width={COLUMN.time}>Time</HeaderCell>}
            <HeaderCell width={COLUMN.duration}>Elapsed</HeaderCell>
            <HeaderCell width={COLUMN.calls}>API calls</HeaderCell>
            <HeaderCell width={COLUMN.type}>Type</HeaderCell>
            <HeaderCell>Message</HeaderCell>
          </Box>

          {filteredLogs.map((log, index) => {
            const hue = log.assetType ? ASSET_HUES[log.assetType] : undefined;
            return (
              <Box
                key={`${log.ts}-${index}`}
                sx={(theme) => ({
                  display: 'flex',
                  alignItems: 'center',
                  borderLeft: `3px solid ${hue ? pal(theme).asset[hue].main : 'transparent'}`,
                  borderBottom:
                    index < filteredLogs.length - 1
                      ? `1px solid ${pal(theme).line.divider}`
                      : 'none',
                  '&:hover': { backgroundColor: pal(theme).surface.hover },
                })}
              >
                <Box sx={{ width: COLUMN.icon, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>
                  <LevelIcon level={log.level} />
                </Box>
                {showTimestamps && (
                  <MonoCell width={COLUMN.time}>{format(new Date(log.ts), TIME_FORMAT)}</MonoCell>
                )}
                <MonoCell width={COLUMN.duration} align="right">
                  +{((log.ts - startTime) / MS_PER_S).toFixed(1)}s
                </MonoCell>
                <MonoCell width={COLUMN.calls} align="center">
                  {log.apiCalls || '-'}
                </MonoCell>
                <Box sx={{ width: COLUMN.type, px: 1 }}>
                  {log.assetType && (
                    <Chip
                      label={log.assetType}
                      size="small"
                      variant="outlined"
                      sx={(theme) =>
                        hue
                          ? {
                              color: pal(theme).asset[hue].strong,
                              borderColor: pal(theme).asset[hue].main,
                            }
                          : {}
                      }
                    />
                  )}
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    px: 1,
                    py: 0.5,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    wordBreak: 'break-word',
                    color:
                      log.level === 'error'
                        ? 'error.main'
                        : log.level === 'warn'
                          ? 'warning.main'
                          : 'text.primary',
                  }}
                >
                  {log.msg}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}
