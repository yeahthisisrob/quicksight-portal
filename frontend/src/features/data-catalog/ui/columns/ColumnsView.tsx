/**
 * The columns tab: plain dataset columns across the selected projects, each
 * tied back to its SMUS listing column (description, glossary terms), with
 * how much it is used and which calculated fields read it.
 */
import { Search } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  InputAdornment,
  Link,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { getApiErrorMessage } from '@/shared/api';
import type { ColumnCatalogItem } from '@/shared/api/modules/data-catalog';
import { Container, EmptyState, pal } from '@/shared/design-system';
import { useDebounce } from '@/shared/lib/useDebounce';

import { useColumns } from '../../lib/useFieldCatalog';

export interface ColumnsViewProps {
  projectId?: string;
  search: string;
  onSearch: (search: string) => void;
  onOpenField: (key: string) => void;
  onOpenListing: (listingId: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 6;
/** A column in a hundred datasets must not push the row off the screen. */
const DATASET_CHIPS = 2;
const TOOLTIP_NAMES = 20;

function Counts({
  counts,
}: {
  counts: { columns: number; datasets: number; withSmus: number; withSmusColumn: number };
}) {
  // Two SMUS numbers, because they fail separately: a dataset that never
  // matched a listing is a linking problem, a listing whose schema does not
  // name the column is an export problem.
  const cells: Array<[string, number]> = [
    ['Columns', counts.columns],
    ['Datasets', counts.datasets],
    ['From a SMUS table', counts.withSmus],
    ['Matched to a SMUS column', counts.withSmusColumn],
  ];
  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: pal(theme).surface.container,
        overflow: 'hidden',
      })}
    >
      {cells.map(([label, value], index) => (
        <Box
          key={label}
          sx={(theme) => ({
            px: 2,
            py: 1.5,
            borderLeft: index === 0 ? 'none' : `1px solid ${pal(theme).line.divider}`,
          })}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {label}
          </Typography>
          <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function SmusCell({
  item,
  onOpenListing,
}: {
  item: ColumnCatalogItem;
  onOpenListing: (id: string) => void;
}) {
  if (!item.smus) {
    return (
      <Tooltip title="No dataset holding this column matched a SMUS listing. Run the SMUS export, or check the dataset's source table.">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          No SMUS listing
        </Typography>
      </Tooltip>
    );
  }
  const { columnName, columnType, match, name, listingColumnCount } = item.smus;
  // QuickSight and Glue rarely spell a type the same way, so show both rather
  // than leaving someone to wonder which one is right.
  const typesDiffer =
    Boolean(columnType) && columnType?.toLowerCase() !== item.dataType?.toLowerCase();
  return (
    <Stack spacing={0.25}>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
      >
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          clickable
          onClick={() => onOpenListing(item.smus?.listingId ?? '')}
          label={columnName ? `${name}.${columnName}` : name}
        />
        {match === 'normalized' && (
          <Tooltip title={`The listing spells it ${columnName}.`}>
            <Chip size="small" variant="outlined" label="renamed" />
          </Tooltip>
        )}
        {item.smus.glossaryTerms.map((term) => (
          <Chip key={term} size="small" label={term} />
        ))}
        {item.smus.url && (
          <Link href={item.smus.url} target="_blank" rel="noreferrer" variant="caption">
            SMUS
          </Link>
        )}
      </Stack>
      {match === 'listing-only' && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Not one of the {listingColumnCount} columns this listing names
        </Typography>
      )}
      {match === 'no-schema' && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          This listing publishes no column list
        </Typography>
      )}
      {typesDiffer && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          SMUS types it {columnType}
        </Typography>
      )}
      {item.smus.description && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {item.smus.description}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * One chip per dataset stops being readable once a column is in dozens of
 * them, so past a couple the rest collapse into a count that names them on
 * hover.
 */
function DatasetsCell({ datasets }: { datasets: ColumnCatalogItem['datasets'] }) {
  const shown = datasets.slice(0, DATASET_CHIPS);
  const rest = datasets.slice(DATASET_CHIPS);
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {shown.map((dataset) => (
        <Chip key={dataset.id} size="small" variant="outlined" label={dataset.name} />
      ))}
      {rest.length > 0 && (
        <Tooltip
          title={
            <Stack>
              {rest.slice(0, TOOLTIP_NAMES).map((dataset) => (
                <span key={dataset.id}>{dataset.name}</span>
              ))}
              {rest.length > TOOLTIP_NAMES && <span>and {rest.length - TOOLTIP_NAMES} more</span>}
            </Stack>
          }
        >
          <Chip size="small" label={`+${rest.length}`} />
        </Tooltip>
      )}
    </Stack>
  );
}

export function ColumnsView({
  projectId,
  search,
  onSearch,
  onOpenField,
  onOpenListing,
}: ColumnsViewProps) {
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const list = useColumns({ projectId, search: debounced || undefined });

  if (list.isError) {
    return (
      <Alert severity="error">
        <AlertTitle>Columns could not be loaded</AlertTitle>
        {getApiErrorMessage(list.error, 'Unknown error')}
      </Alert>
    );
  }
  // Columns come from the QuickSight export; a missing SMUS export costs the
  // tie-back and nothing else, so it is a note rather than an empty page.
  const items = list.data?.items ?? [];

  return (
    <Stack spacing={2}>
      {list.data ? (
        <Counts counts={list.data.counts} />
      ) : (
        <Skeleton variant="rectangular" height={72} />
      )}
      <Container
        header="Columns"
        description="Every plain column the selected projects' datasets expose, with what SMUS says about it."
        actions={
          <TextField
            size="small"
            placeholder="Column name"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'aria-label': 'Search columns' },
            }}
          />
        }
        disableContentPadding
      >
        {list.isPending ? (
          <Stack spacing={1} sx={{ p: 2 }}>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <Skeleton key={i} variant="text" />
            ))}
          </Stack>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            title={debounced ? 'Nothing matches' : 'No columns in the selected projects'}
            description={
              debounced
                ? 'Clear the search to see every column.'
                : 'Columns come from the QuickSight export of the datasets that read the selected projects.'
            }
          />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader aria-label="Columns">
              <TableHead>
                <TableRow>
                  <TableCell>Column</TableCell>
                  <TableCell>Datasets</TableCell>
                  <TableCell>SMUS column</TableCell>
                  <TableCell align="right">
                    <Tooltip title="dashboards / analyses / visuals">
                      <span>Used by</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>Read by calculated fields</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.name} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {item.name}
                      </Typography>
                      {item.dataType && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {item.dataType.toLowerCase()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <DatasetsCell datasets={item.datasets} />
                    </TableCell>
                    <TableCell>
                      <SmusCell item={item} onOpenListing={onOpenListing} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" component="span">
                        {item.usedBy.dashboards} / {item.usedBy.analyses} / {item.usedBy.visuals}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {item.usedByCalculated.length === 0 ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            none
                          </Typography>
                        ) : (
                          item.usedByCalculated.map((calc) => (
                            <Chip
                              key={calc.key}
                              size="small"
                              clickable
                              onClick={() => onOpenField(calc.key)}
                              label={calc.name}
                              sx={{ fontFamily: 'monospace' }}
                            />
                          ))
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Container>
    </Stack>
  );
}
