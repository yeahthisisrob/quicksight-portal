/**
 * One field's lineage across the account, from the context graph: where it
 * comes from (the parent dataset's column or the governed listing column,
 * through renames) and what a change to it touches (the calculated fields
 * that read it, and every visual that shows it or them).
 */
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { type ContextHit, contextApi } from '@/shared/api/modules/search';

const TRACE_DEPTH = 3;
const TRACE_LIMIT = 200;

/** The analysis or dashboard a visual sits on. */
function visualAsset(hit: ContextHit): string {
  const { assetType, assetName } = hit.attributes ?? {};
  return assetName ? `${assetType} ${assetName}` : 'another asset';
}

export function FieldTrace({ entityId }: { entityId: string }) {
  const upstream = useQuery({
    queryKey: ['field-trace-up', entityId],
    queryFn: () =>
      contextApi.related(entityId, {
        relations: ['derived-from', 'reads-field'],
        direction: 'out',
        depth: TRACE_DEPTH,
        limit: TRACE_LIMIT,
      }),
  });
  const downstream = useQuery({
    queryKey: ['field-trace-down', entityId],
    queryFn: () =>
      contextApi.related(entityId, {
        relations: ['reads-field', 'shows'],
        direction: 'in',
        depth: TRACE_DEPTH,
        limit: TRACE_LIMIT,
      }),
  });
  if (upstream.isLoading || downstream.isLoading) return <CircularProgress size={16} />;
  if (upstream.error || downstream.error) {
    return <Alert severity="warning">The lineage could not be read.</Alert>;
  }
  const sources = (upstream.data?.hits ?? []).filter(
    (h) => h.type === 'dataset-column' || h.type === 'listing-column'
  );
  const touched = downstream.data?.hits ?? [];
  const fields = touched.filter((h) => h.type === 'calculated-field');
  const visuals = touched.filter((h) => h.type === 'visual');
  const byAsset = new Map<string, ContextHit[]>();
  for (const visual of visuals) {
    const asset = visualAsset(visual);
    byAsset.set(asset, [...(byAsset.get(asset) ?? []), visual]);
  }

  return (
    <Stack spacing={1} sx={{ py: 0.5 }}>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Comes from
        </Typography>
        {sources.length === 0 ? (
          <Typography variant="body2">Its own source; nothing traced further up.</Typography>
        ) : (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
            {sources.map((s) => (
              <Chip key={s.entityId} size="small" variant="outlined" label={s.summary ?? s.name} />
            ))}
          </Stack>
        )}
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          A change touches
        </Typography>
        {touched.length === 0 ? (
          <Typography variant="body2">Nothing reads it.</Typography>
        ) : (
          <>
            <Typography variant="body2">
              {fields.length} calculated field{fields.length === 1 ? '' : 's'}, {visuals.length}{' '}
              visual{visuals.length === 1 ? '' : 's'} in {byAsset.size} asset
              {byAsset.size === 1 ? '' : 's'}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {fields.length > 0 && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {fields.map((f) => (
                    <Chip
                      key={f.entityId}
                      size="small"
                      variant="outlined"
                      label={f.name}
                      sx={{ fontFamily: 'monospace' }}
                    />
                  ))}
                </Stack>
              )}
              {[...byAsset].map(([asset, shown]) => (
                <Typography key={asset} variant="body2" sx={{ color: 'text.secondary' }}>
                  {asset}: {shown.map((v) => v.name).join(', ')}
                </Typography>
              ))}
            </Stack>
          </>
        )}
      </Box>
    </Stack>
  );
}
