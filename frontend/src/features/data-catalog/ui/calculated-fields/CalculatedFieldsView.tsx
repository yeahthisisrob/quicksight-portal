/**
 * The calculated fields tab: counts that filter, a search over names and
 * expressions, the table, and the detail beside it once a row is chosen.
 */
import { Search } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '@/shared/api';
import { Container, EmptyState, pal } from '@/shared/design-system';
import { useDebounce } from '@/shared/lib/useDebounce';

import { useCalculatedField, useCalculatedFields } from '../../lib/useFieldCatalog';
import {
  CALCULATED_FIELD_SORTS,
  type CalculatedFieldSort,
  isUnused,
  sortCalculatedFields,
} from '../../model/fieldCatalog';
import { CalculatedFieldDetail } from './CalculatedFieldDetail';
import { CalculatedFieldsTable } from './CalculatedFieldsTable';
import { type CountFilter, FieldCounts } from './FieldCounts';

export interface CalculatedFieldsViewProps {
  projectId?: string;
  search: string;
  onSearch: (search: string) => void;
  conflictsOnly: boolean;
  onConflictsOnly: (on: boolean) => void;
  selectedKey?: string;
  onSelect: (key: string | undefined) => void;
  onOpenListing: (listingId: string) => void;
  /** Rendered when no export has run: the page decides what to say. */
}

const SEARCH_DEBOUNCE_MS = 300;
const DETAIL_MIN_WIDTH = 520;
const SKELETON_ROWS = 6;
const SEARCH_WIDTH = 260;
const SEARCH_WIDTH_COMPACT = 170;
const SORT_WIDTH = 180;
const SORT_WIDTH_COMPACT = 140;

export function CalculatedFieldsView({
  projectId,
  search,
  onSearch,
  conflictsOnly,
  onConflictsOnly,
  selectedKey,
  onSelect,
  onOpenListing,
}: CalculatedFieldsViewProps) {
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState<CalculatedFieldSort>('name');
  const [countFilter, setCountFilter] = useState<CountFilter | undefined>(
    conflictsOnly ? 'conflicts' : undefined
  );

  const list = useCalculatedFields({ projectId, search: debounced || undefined, conflictsOnly });
  const detail = useCalculatedField(selectedKey);

  // The conflicts tile and the URL flag are the same switch.
  useEffect(() => {
    if (conflictsOnly && countFilter !== 'conflicts') setCountFilter('conflicts');
    if (!conflictsOnly && countFilter === 'conflicts') setCountFilter(undefined);
  }, [conflictsOnly, countFilter]);

  const items = useMemo(() => {
    const all = list.data?.items ?? [];
    const narrowed =
      countFilter === 'unused'
        ? all.filter(isUnused)
        : countFilter === 'templated'
          ? all.filter((i) => i.template)
          : all;
    return sortCalculatedFields(narrowed, sort);
  }, [list.data, countFilter, sort]);

  // A search that lands on exactly one field opens it: that is how a hit from
  // the command palette (which carries the name) arrives here.
  useEffect(() => {
    if (!selectedKey && debounced && items.length === 1 && items[0]) {
      onSelect(items[0].key);
    }
  }, [debounced, items, selectedKey, onSelect]);

  const toggle = (filter: CountFilter) => {
    const next = countFilter === filter ? undefined : filter;
    setCountFilter(next);
    onConflictsOnly(next === 'conflicts');
  };

  if (list.isError) {
    return (
      <Alert severity="error">
        <AlertTitle>Calculated fields could not be loaded</AlertTitle>
        {getApiErrorMessage(list.error, 'Unknown error')}
      </Alert>
    );
  }
  // A missing SMUS export costs the tie-back to listings, nothing else: the
  // calculated fields themselves are QuickSight's, and hiding them behind a
  // SMUS export is what made the catalog look empty.
  const smusMissing = Boolean(list.data && !list.data.exportedAt);

  const open = Boolean(selectedKey);

  return (
    <Stack spacing={2}>
      {list.data ? (
        <FieldCounts counts={list.data.counts} active={countFilter} onToggle={toggle} />
      ) : (
        <Skeleton variant="rectangular" height={72} />
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: open
            ? { xs: '1fr', lg: `minmax(0, 1fr) minmax(${DETAIL_MIN_WIDTH}px, 1.1fr)` }
            : '1fr',
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Container
          header={open ? 'Fields' : 'Calculated fields'}
          description={
            list.data
              ? `${items.length} of ${list.data.counts.fields}${countFilter ? ` · ${countFilter}` : ''}`
              : undefined
          }
          actions={
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Name or expression"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                sx={{ width: open ? SEARCH_WIDTH_COMPACT : SEARCH_WIDTH }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { 'aria-label': 'Search calculated fields' },
                }}
              />
              <FormControl size="small" sx={{ minWidth: open ? SORT_WIDTH_COMPACT : SORT_WIDTH }}>
                <InputLabel id="calculated-fields-sort">Sort</InputLabel>
                <Select
                  labelId="calculated-fields-sort"
                  label="Sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as CalculatedFieldSort)}
                >
                  {CALCULATED_FIELD_SORTS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
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
              title={
                debounced || countFilter
                  ? 'Nothing matches'
                  : 'No calculated fields in the selected projects'
              }
              description={
                debounced || countFilter
                  ? 'Clear the search or the count filter to see every calculated field.'
                  : 'Calculated fields come from the QuickSight export: datasets, dashboards and analyses that declare one. Run an export from Operations if this looks wrong.'
              }
            />
          ) : (
            <Box
              sx={(theme) => ({
                overflowX: 'auto',
                '& .MuiTableRow-root.Mui-selected': { bgcolor: pal(theme).surface.selected },
              })}
            >
              <CalculatedFieldsTable
                items={items}
                selectedKey={selectedKey}
                onSelect={(key) => onSelect(key === selectedKey ? undefined : key)}
                compact={open}
              />
            </Box>
          )}
        </Container>
        {open && (
          <Box sx={{ minWidth: 0, position: { lg: 'sticky' }, top: { lg: 16 } }}>
            <CalculatedFieldDetail
              detail={detail.data}
              loading={detail.isPending}
              error={detail.isError ? getApiErrorMessage(detail.error, 'Unknown error') : null}
              onOpenField={(key) => onSelect(key)}
              onOpenListing={onOpenListing}
              onClose={() => onSelect(undefined)}
            />
          </Box>
        )}
      </Box>
      {list.data && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {smusMissing
            ? 'From the QuickSight export. No SMUS export yet, so nothing is tied back to a listing.'
            : `From the QuickSight export, tied to the SMUS export of ${new Date(
                list.data.exportedAt as string
              ).toLocaleString()}.`}
        </Typography>
      )}
    </Stack>
  );
}
