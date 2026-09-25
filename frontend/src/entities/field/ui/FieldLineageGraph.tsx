/**
 * A calculated field's dependency chain, drawn.
 *
 * Sources on the left, the field in the middle, what is computed from it on
 * the right, with the edges between them. Every calculated node is clickable
 * and opens that field, so the chain is walked rather than read. The layout is
 * arithmetic (see model/fieldLineage), so nothing here measures the DOM.
 */
import { Functions, TableChart } from '@mui/icons-material';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';

import type { FieldLineage } from '@/shared/api/modules/data-catalog';
import { EmptyState, pal } from '@/shared/design-system';

import {
  describeDepth,
  layoutLineage,
  NODE_HEIGHT,
  NODE_WIDTH,
  type PlacedNode,
} from '../model/fieldLineage';

interface FieldLineageGraphProps {
  lineage: FieldLineage;
  /** The node the chain is drawn around; it gets the ring. */
  focusKey: string;
  onOpenField: (key: string) => void;
  /** Taller when the graph has a dialog to itself. */
  maxHeight?: number;
}

const DEFAULT_MAX_HEIGHT = 420;

function NodeCard({
  node,
  focused,
  onOpen,
}: {
  node: PlacedNode;
  focused: boolean;
  onOpen?: () => void;
}) {
  const calculated = node.kind === 'calculated';
  const usage = node.usedBy;
  const card = (
    <Box
      component={onOpen ? 'button' : 'div'}
      type={onOpen ? 'button' : undefined}
      onClick={onOpen}
      sx={(theme) => ({
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        m: 0,
        px: 1.25,
        py: 0.75,
        textAlign: 'left',
        font: 'inherit',
        overflow: 'hidden',
        cursor: onOpen ? 'pointer' : 'default',
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${focused ? pal(theme).brand.primary : pal(theme).line.default}`,
        outline: focused ? `2px solid ${pal(theme).brand.primary}` : 'none',
        outlineOffset: 1,
        bgcolor: focused ? pal(theme).surface.selected : pal(theme).surface.container,
        '&:hover': onOpen ? { borderColor: pal(theme).brand.primary } : undefined,
      })}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
        {calculated ? (
          <Functions fontSize="inherit" sx={(theme) => ({ color: pal(theme).brand.primary })} />
        ) : (
          <TableChart fontSize="inherit" sx={{ color: 'text.secondary' }} />
        )}
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        component="div"
        sx={{
          color: 'text.secondary',
          fontFamily: calculated ? 'monospace' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {calculated
          ? node.expression
          : (node.datasetName ?? node.dataType?.toLowerCase() ?? 'column')}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.25, alignItems: 'center' }}>
        {node.smus && (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 16, '& .MuiChip-label': { px: 0.5, fontSize: 10 } }}
            label="SMUS"
          />
        )}
        {usage && usage.dashboards + usage.analyses + usage.visuals > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
            {usage.dashboards}d · {usage.analyses}a · {usage.visuals}v
          </Typography>
        )}
      </Stack>
    </Box>
  );

  const title = [
    node.kind === 'calculated' ? node.expression : node.datasetName,
    node.smus
      ? `SMUS: ${node.smus.name}${node.smus.columnName ? `.${node.smus.columnName}` : ''}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' — ');
  return title ? (
    <Tooltip title={title} enterDelay={500}>
      {card}
    </Tooltip>
  ) : (
    card
  );
}

export function FieldLineageGraph({
  lineage,
  focusKey,
  onOpenField,
  maxHeight = DEFAULT_MAX_HEIGHT,
}: FieldLineageGraphProps) {
  const layout = layoutLineage(lineage);
  const focusId = `cf:${focusKey}`;

  if (layout.nodes.length <= 1) {
    return (
      <EmptyState
        compact
        title="Nothing else in the chain"
        description="This field reads no other field in its datasets, and no other calculated field reads it."
      />
    );
  }

  return (
    <Stack spacing={0.5}>
      <Box sx={{ overflow: 'auto', maxHeight, pb: 0.5 }}>
        <Box sx={{ position: 'relative', width: layout.width, height: layout.height }}>
          <Box
            component="svg"
            width={layout.width}
            height={layout.height}
            aria-hidden
            sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="lineage-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
              </marker>
            </defs>
            {layout.edges.map((edge) => (
              <Box
                key={edge.id}
                component="path"
                d={edge.d}
                fill="none"
                markerEnd="url(#lineage-arrow)"
                sx={(theme) => ({
                  color: pal(theme).line.default,
                  stroke: 'currentColor',
                  strokeWidth: 1.5,
                  strokeDasharray: edge.backwards ? '4 3' : undefined,
                  opacity: edge.from === focusId || edge.to === focusId ? 1 : 0.55,
                  ...(edge.from === focusId || edge.to === focusId
                    ? { color: pal(theme).brand.primary }
                    : {}),
                })}
              />
            ))}
          </Box>
          {layout.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              focused={node.id === focusId}
              onOpen={
                node.key && node.id !== focusId ? () => onOpenField(node.key as string) : undefined
              }
            />
          ))}
        </Box>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {layout.depths.map(describeDepth).join(' → ')}
        {lineage.truncated ? ' · the chain is deeper than this; open a node to keep walking' : ''}
      </Typography>
    </Stack>
  );
}
