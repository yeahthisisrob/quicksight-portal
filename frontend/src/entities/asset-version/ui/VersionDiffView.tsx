/**
 * What changed between two versions: the lines in words, the differing
 * paths, and on request the two definitions side by side.
 */
import { DiffEditor } from '@monaco-editor/react';
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type { VersionDiff, VersionDiffEntry } from '@/shared/api/modules/history';
import { EmptyState, pal } from '@/shared/design-system';

const MAX_PATHS = 80;
const DIFF_HEIGHT = 520;
const JSON_INDENT = 2;

function short(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function kindColor(kind: VersionDiffEntry['kind']): 'success' | 'error' | 'warning' {
  if (kind === 'added') return 'success';
  if (kind === 'removed') return 'error';
  return 'warning';
}

function ChangedPaths({ entries, truncated }: { entries: VersionDiffEntry[]; truncated: boolean }) {
  const shown = entries.slice(0, MAX_PATHS);
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Changed paths">
        <TableHead>
          <TableRow>
            <TableCell>Path</TableCell>
            <TableCell>Change</TableCell>
            <TableCell>Before</TableCell>
            <TableCell>After</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((entry) => (
            <TableRow key={`${entry.kind}:${entry.path}`}>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {entry.path}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={entry.kind}
                  color={kindColor(entry.kind)}
                  variant="outlined"
                />
              </TableCell>
              <TableCell
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  maxWidth: 260,
                  wordBreak: 'break-all',
                }}
              >
                {short(entry.before)}
              </TableCell>
              <TableCell
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  maxWidth: 260,
                  wordBreak: 'break-all',
                }}
              >
                {short(entry.after)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(entries.length > MAX_PATHS || truncated) && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          {truncated
            ? 'More paths differ than are listed; the side-by-side view shows everything.'
            : `${entries.length - MAX_PATHS} more paths differ.`}
        </Typography>
      )}
    </Box>
  );
}

interface VersionDiffViewProps {
  diff: VersionDiff;
  /** What the two sides are called: "Oct 12 09:30" and "Oct 13 11:30", say. */
  fromLabel: string;
  toLabel: string;
}

export function VersionDiffView({ diff, fromLabel, toLabel }: VersionDiffViewProps) {
  const [sideBySide, setSideBySide] = useState(false);
  const nothing = diff.changes.length === 0 && diff.entries.length === 0;
  if (nothing) {
    return (
      <EmptyState
        compact
        title="No difference"
        description={`${fromLabel} and ${toLabel} hold the same definition.`}
      />
    );
  }
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          {diff.summary}
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {diff.changes.map((line) => (
            <li key={line}>
              <Typography variant="body2">{line}</Typography>
            </li>
          ))}
        </Box>
      </Box>
      {diff.entries.length > 0 && (
        <ChangedPaths entries={diff.entries} truncated={diff.truncated} />
      )}
      {diff.toDefinition && (
        <Box>
          <Button size="small" variant="outlined" onClick={() => setSideBySide((v) => !v)}>
            {sideBySide ? 'Hide the JSON' : 'Show side by side as JSON'}
          </Button>
          {sideBySide && (
            <Box
              sx={(theme) => ({
                mt: 1.5,
                border: `1px solid ${pal(theme).line.divider}`,
                borderRadius: `${theme.shape.borderRadius}px`,
                overflow: 'hidden',
              })}
            >
              <Stack direction="row" sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ flex: 1, fontWeight: 700 }}>
                  {fromLabel}
                </Typography>
                <Typography variant="caption" sx={{ flex: 1, fontWeight: 700 }}>
                  {toLabel}
                </Typography>
              </Stack>
              <DiffEditor
                height={DIFF_HEIGHT}
                language="json"
                original={JSON.stringify(diff.fromDefinition ?? {}, null, JSON_INDENT)}
                modified={JSON.stringify(diff.toDefinition, null, JSON_INDENT)}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );
}
