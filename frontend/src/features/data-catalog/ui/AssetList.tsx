import { Search } from '@mui/icons-material';
import {
  Box,
  ButtonBase,
  Chip,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type { GlossaryTerm, SmusCatalogAssetSummary } from '@/shared/api/modules/data-catalog';
import { EmptyState, pal, StatusIndicator } from '@/shared/design-system';

interface AssetListProps {
  assets: SmusCatalogAssetSummary[];
  terms: Array<GlossaryTerm & { count: number }>;
  selectedId?: string;
  onSelect: (listingId: string) => void;
  search: string;
  onSearch: (value: string) => void;
  term?: string;
  onTerm: (term?: string) => void;
  loading?: boolean;
  /** Extra filter controls rendered under the search box. */
  filters?: React.ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
}

const SKELETON_ROWS = 6;

function DatasetMark({ asset }: { asset: SmusCatalogAssetSummary }) {
  const n = asset.datasets.length;
  if (n === 0) {
    return (
      <StatusIndicator type="stopped" size="small">
        No QuickSight dataset
      </StatusIndicator>
    );
  }
  return (
    <StatusIndicator type="success" size="small">
      Read by {n} {n === 1 ? 'dataset' : 'datasets'}
    </StatusIndicator>
  );
}

function AssetRow({
  asset,
  selected,
  onSelect,
}: {
  asset: SmusCatalogAssetSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ButtonBase
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        textAlign: 'left',
        px: 2,
        py: 1.5,
        borderLeft: `3px solid ${selected ? pal(theme).brand.primary : 'transparent'}`,
        bgcolor: selected ? pal(theme).surface.selected : 'transparent',
        '&:hover': { bgcolor: pal(theme).surface.hover },
      })}
    >
      <Typography variant="subtitle2" noWrap>
        {asset.name}
      </Typography>
      {asset.table && (
        <Typography
          variant="caption"
          sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block' }}
          noWrap
        >
          {asset.table.database}.{asset.table.name}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ mt: 0.75, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <DatasetMark asset={asset} />
        {asset.glossaryTerms.slice(0, 3).map((t) => (
          <Chip key={t.name} size="small" variant="outlined" label={t.name} />
        ))}
        {asset.glossaryTerms.length > 3 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            +{asset.glossaryTerms.length - 3}
          </Typography>
        )}
      </Stack>
    </ButtonBase>
  );
}

/** The left pane: search, term chips, tag filter and the project's assets. */
export function AssetList({
  assets,
  terms,
  selectedId,
  onSelect,
  search,
  onSearch,
  term,
  onTerm,
  loading,
  filters,
  emptyTitle,
  emptyDescription,
}: AssetListProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <TextField
          size="small"
          placeholder="Search name, table or column"
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
          }}
        />
        {filters}
        {terms.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {terms.map((t) => (
              <Chip
                key={t.name}
                size="small"
                label={`${t.name} (${t.count})`}
                color={term === t.name ? 'primary' : 'default'}
                variant={term === t.name ? 'filled' : 'outlined'}
                onClick={() => onTerm(term === t.name ? undefined : t.name)}
                title={t.shortDescription}
              />
            ))}
          </Stack>
        )}
      </Stack>
      <Box sx={(theme) => ({ borderTop: `1px solid ${pal(theme).line.divider}` })} />
      {loading ? (
        <Stack spacing={0} sx={{ p: 2 }}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <Box key={i} sx={{ py: 1 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
            </Box>
          ))}
        </Stack>
      ) : assets.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <EmptyState compact title={emptyTitle} description={emptyDescription} />
        </Box>
      ) : (
        <Box sx={{ overflowY: 'auto' }}>
          {assets.map((asset) => (
            <AssetRow
              key={asset.listingId}
              asset={asset}
              selected={asset.listingId === selectedId}
              onSelect={() => onSelect(asset.listingId)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
