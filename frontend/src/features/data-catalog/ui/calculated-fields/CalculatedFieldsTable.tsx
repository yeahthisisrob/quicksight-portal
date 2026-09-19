/**
 * The calculated fields table: one row per distinct expression. Dense on
 * purpose, with the expression in monospace and the numbers that matter:
 * where it is defined, how much it is used, whether it conflicts.
 */
import { CollectionsBookmark, Notes } from '@mui/icons-material';
import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import type { CalculatedFieldSummary } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';

import { describeDefinedIn, totalUsage } from '../../model/fieldCatalog';

interface CalculatedFieldsTableProps {
  items: CalculatedFieldSummary[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  /** Narrow mode when a detail pane is open: name, expression and usage only. */
  compact?: boolean;
}

const EXPRESSION_MAX_WIDTH = 420;
const EXPRESSION_MAX_WIDTH_COMPACT = 220;

function UsageCell({ item }: { item: CalculatedFieldSummary }) {
  const { dashboards, analyses, visuals } = item.usedBy;
  const total = totalUsage(item);
  if (total === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        unused
      </Typography>
    );
  }
  return (
    <Tooltip title={`${dashboards} dashboards · ${analyses} analyses · ${visuals} visuals`}>
      <Typography variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
        {dashboards} / {analyses} / {visuals}
      </Typography>
    </Tooltip>
  );
}

export function CalculatedFieldsTable({
  items,
  selectedKey,
  onSelect,
  compact = false,
}: CalculatedFieldsTableProps) {
  return (
    <Table size="small" stickyHeader aria-label="Calculated fields">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Expression</TableCell>
          {!compact && <TableCell>Defined in</TableCell>}
          {!compact && <TableCell>Datasets</TableCell>}
          <TableCell align="right">
            <Tooltip title="dashboards / analyses / visuals">
              <span>Used by</span>
            </Tooltip>
          </TableCell>
          {!compact && <TableCell />}
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => {
          const selected = item.key === selectedKey;
          return (
            <TableRow
              key={item.key}
              hover
              selected={selected}
              onClick={() => onSelect(item.key)}
              sx={{ cursor: 'pointer' }}
              aria-selected={selected}
            >
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.name}
                  </Typography>
                  {item.conflict && (
                    <Chip
                      size="small"
                      color="warning"
                      label={`${item.conflict.variants + 1} variants`}
                    />
                  )}
                  {item.template && (
                    <Tooltip title="In the template library">
                      <CollectionsBookmark
                        fontSize="inherit"
                        sx={(theme) => ({ color: pal(theme).brand.primary })}
                      />
                    </Tooltip>
                  )}
                  {item.hasNote && (
                    <Tooltip title="Has a portal note">
                      <Notes fontSize="inherit" sx={{ color: 'text.secondary' }} />
                    </Tooltip>
                  )}
                </Stack>
                {item.dataType && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {item.dataType.toLowerCase()}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Tooltip title={item.expression} enterDelay={600}>
                  <Typography
                    variant="body2"
                    component="code"
                    sx={{
                      fontFamily: 'monospace',
                      display: 'block',
                      maxWidth: compact ? EXPRESSION_MAX_WIDTH_COMPACT : EXPRESSION_MAX_WIDTH,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.expression}
                  </Typography>
                </Tooltip>
              </TableCell>
              {!compact && (
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip
                    title={
                      <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
                        {item.definedIn.map((d) => `${d.type}: ${d.name}`).join('\n')}
                      </Box>
                    }
                  >
                    <Typography variant="body2" component="span">
                      {describeDefinedIn(item.definedIn)}
                    </Typography>
                  </Tooltip>
                </TableCell>
              )}
              {!compact && (
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {item.datasets.map((dataset) => (
                      <Tooltip
                        key={dataset.id}
                        title={
                          dataset.listing
                            ? `SMUS listing ${dataset.listing.name}${dataset.listing.projectName ? ` in ${dataset.listing.projectName}` : ''}`
                            : 'Not tied to a SMUS listing'
                        }
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          label={dataset.name}
                          color={dataset.listing ? 'primary' : 'default'}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </TableCell>
              )}
              <TableCell align="right">
                <UsageCell item={item} />
              </TableCell>
              {!compact && (
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {item.references.length} read{item.references.length === 1 ? '' : 's'}
                  </Typography>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
