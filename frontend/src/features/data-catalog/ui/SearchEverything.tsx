/**
 * The catalog's other search mode: not this project's listings but
 * everything the portal knows that a catalog user asks about - calculated
 * fields (matched on their expressions, where the rules live), visuals and
 * SMUS listings across every project. A listing opens in place; anything
 * else navigates to where it lives.
 */
import { Search } from '@mui/icons-material';
import { Box, CircularProgress, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import type { SearchableType, SearchHit } from '@/shared/api/modules/search';
import { EmptyState, SegmentedControl } from '@/shared/design-system';
import { describeIndexed, SEARCH_MIN_LENGTH, useSearchHits } from '@/shared/lib/search';
import { SearchHitList } from '@/shared/ui';

export type CatalogSearchScope = 'project' | 'everything';

export const CATALOG_SCOPES: Array<{ value: CatalogSearchScope; label: string }> = [
  { value: 'project', label: 'This project' },
  { value: 'everything', label: 'Everything' },
];

const EVERYTHING_TYPES: SearchableType[] = ['calculated-field', 'visual', 'smus-listing'];
const RESULT_LIMIT = 40;

interface SearchEverythingProps {
  search: string;
  onSearch: (value: string) => void;
  scope: CatalogSearchScope;
  onScope: (scope: CatalogSearchScope) => void;
  /** A listing hit opens in the catalog rather than navigating. */
  onOpenListing: (listingId: string) => void;
}

export function SearchEverything({
  search,
  onSearch,
  scope,
  onScope,
  onOpenListing,
}: SearchEverythingProps) {
  const navigate = useNavigate();
  const found = useSearchHits(search, { types: EVERYTHING_TYPES, limit: RESULT_LIMIT });
  const typedEnough = search.trim().length >= SEARCH_MIN_LENGTH;

  const open = (hit: SearchHit) => {
    if (hit.type === 'smus-listing') {
      onOpenListing(hit.id);
    } else {
      navigate(hit.path);
    }
  };

  let body: React.ReactNode;
  if (!typedEnough) {
    body = (
      <Typography variant="body2" sx={{ color: 'text.secondary', px: 2, py: 2 }}>
        Search calculated fields by name or by what their expression says, visuals by what they
        show, and listings across every project.
      </Typography>
    );
  } else if (found.error) {
    body = (
      <Typography variant="body2" color="error" sx={{ px: 2, py: 2 }}>
        {getApiErrorMessage(found.error, 'Search failed')}
      </Typography>
    );
  } else if (found.loading && found.hits.length === 0) {
    body = (
      <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  } else if (found.hits.length === 0) {
    body = (
      <EmptyState
        compact
        title={`Nothing matches "${found.query}"`}
        description={found.indexed ? `Searched ${describeIndexed(found.indexed)}.` : undefined}
      />
    );
  } else {
    body = <SearchHitList hits={found.hits} onSelect={open} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <TextField
          size="small"
          placeholder="Describe a rule, a visual or a table"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {found.loading ? <CircularProgress size={16} /> : <Search fontSize="small" />}
                </InputAdornment>
              ),
            },
          }}
        />
        <SegmentedControl<CatalogSearchScope>
          size="small"
          ariaLabel="Search scope"
          value={scope}
          onChange={onScope}
          options={CATALOG_SCOPES}
        />
      </Stack>
      <Box sx={{ overflowY: 'auto', px: 1, pb: 1 }}>{body}</Box>
    </Box>
  );
}
