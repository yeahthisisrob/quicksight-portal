/**
 * Field lineage, both directions, inside one dataset.
 *
 * Upstream: what the focused field's expression reads, recursively down to
 * plain columns. Downstream: every calculated field that reads the focused
 * field, recursively up to the visuals that show them. Any node is clickable
 * and becomes the focus, so a person can walk the graph in either direction
 * without leaving the dialog.
 */
import { ArrowDownward, ArrowUpward, Close } from '@mui/icons-material';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useMemo, useState } from 'react';

import type { CatalogDataset, DatasetCatalogField } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';
import { functionCategories, getDocLink } from '@/shared/lib/functionCategories';

interface ExpressionGraphDialogProps {
  open: boolean;
  onClose: () => void;
  dataset: CatalogDataset;
  /** The field to start from; the user can move focus inside the dialog. */
  fieldName: string;
}

const MAX_DEPTH = 8;

/** Function names in an expression become links to the QuickSight docs. */
export function expressionWithDocLinks(expression: string): React.ReactNode[] {
  const pattern = /\b(\w+)\s*(\()/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(expression);
  while (match !== null) {
    const [, name, paren] = match;
    if (match.index > last) parts.push(expression.slice(last, match.index));
    const doc = functionCategories[(name ?? '').toUpperCase()]?.standardFunction;
    const href = doc ? getDocLink(doc) : undefined;
    parts.push(
      href ? (
        <a key={match.index} href={href} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      ) : (
        name
      )
    );
    parts.push(paren);
    last = pattern.lastIndex;
    match = pattern.exec(expression);
  }
  if (last < expression.length) parts.push(expression.slice(last));
  return parts;
}

interface LineageNode {
  name: string;
  field?: DatasetCatalogField;
  depth: number;
}

/** Walk one direction from `start`, breadth-first, never repeating a field. */
export function walkLineage(
  dataset: CatalogDataset,
  start: string,
  direction: 'up' | 'down'
): LineageNode[] {
  const byName = new Map(dataset.fields.map((f) => [f.name, f]));
  const seen = new Set<string>([start]);
  const out: LineageNode[] = [];
  let frontier = [start];
  for (let depth = 1; depth <= MAX_DEPTH && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const name of frontier) {
      const field = byName.get(name);
      const links = direction === 'up' ? (field?.references ?? []) : (field?.usedBy ?? []);
      for (const link of links) {
        if (seen.has(link)) continue;
        seen.add(link);
        out.push({ name: link, field: byName.get(link), depth });
        next.push(link);
      }
    }
    frontier = next;
  }
  return out;
}

function NodeCard({
  node,
  focused,
  onFocus,
}: {
  node: LineageNode;
  focused: boolean;
  onFocus: () => void;
}) {
  const field = node.field;
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => e.key === 'Enter' && onFocus()}
      sx={(theme) => ({
        ml: (node.depth - 1) * 3,
        p: 1.5,
        cursor: 'pointer',
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${focused ? pal(theme).brand.primary : pal(theme).line.default}`,
        bgcolor: focused ? pal(theme).surface.selected : pal(theme).surface.container,
        '&:hover': { borderColor: pal(theme).brand.primary },
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
          {node.name}
        </Typography>
        {field ? (
          <Chip
            size="small"
            variant="outlined"
            label={field.isCalculated ? 'calculated' : field.dataType}
          />
        ) : (
          <Chip size="small" variant="outlined" color="warning" label="not in this dataset" />
        )}
        {field && field.usage.dashboards + field.usage.analyses > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {field.usage.dashboards} dashboards, {field.usage.analyses} analyses
          </Typography>
        )}
      </Stack>
      {field?.expression && (
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.5 }}
        >
          {expressionWithDocLinks(field.expression)}
        </Typography>
      )}
    </Box>
  );
}

export default function ExpressionGraphDialog({
  open,
  onClose,
  dataset,
  fieldName,
}: ExpressionGraphDialogProps) {
  const [focus, setFocus] = useState(fieldName);
  const field = dataset.fields.find((f) => f.name === focus);
  const upstream = useMemo(() => walkLineage(dataset, focus, 'up'), [dataset, focus]);
  const downstream = useMemo(() => walkLineage(dataset, focus, 'down'), [dataset, focus]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Typography variant="h6" component="span" sx={{ fontFamily: 'monospace' }}>
          {focus}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Lineage inside {dataset.name}. Click any field to move the focus.
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {field?.expression && (
            <Box
              component="pre"
              sx={(theme) => ({
                m: 0,
                p: 1.5,
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                bgcolor: pal(theme).surface.page,
                border: `1px solid ${pal(theme).line.divider}`,
                borderRadius: `${theme.shape.borderRadius}px`,
              })}
            >
              {expressionWithDocLinks(field.expression)}
            </Box>
          )}

          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
              <ArrowDownward fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2">Reads from</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {upstream.length === 0
                  ? field?.isCalculated
                    ? 'nothing in this dataset'
                    : 'a plain column; nothing upstream'
                  : `${upstream.length} field${upstream.length === 1 ? '' : 's'}, down to the columns`}
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {upstream.map((node) => (
                <NodeCard
                  key={`up-${node.name}`}
                  node={node}
                  focused={false}
                  onFocus={() => setFocus(node.name)}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
              <ArrowUpward fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2">Read by</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {downstream.length === 0
                  ? 'no calculated field reads this one'
                  : `${downstream.length} calculated field${downstream.length === 1 ? '' : 's'}`}
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {downstream.map((node) => (
                <NodeCard
                  key={`down-${node.name}`}
                  node={node}
                  focused={false}
                  onFocus={() => setFocus(node.name)}
                />
              ))}
            </Stack>
          </Box>

          {field && (field.visuals?.length ?? 0) > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Shown in
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {field.visuals?.map((v) => (
                  <Chip
                    key={`${v.assetId}/${v.visualId}`}
                    size="small"
                    variant="outlined"
                    label={`${v.assetName}${v.sheetName ? ` › ${v.sheetName}` : ''} › ${v.visualName}`}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
