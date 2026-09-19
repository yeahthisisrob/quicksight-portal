/**
 * "Audience from": the dashboard or analysis whose permissions a new asset
 * inherits. Searches both lists as you type; clearing it leaves the audience
 * to the template, or to nobody but the author.
 */
import { Groups } from '@mui/icons-material';
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { RebindSource } from '@/entities/definition';

import { assetsApi } from '@/shared/api';
import { useDebounce } from '@/shared/lib/useDebounce';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 15;

const TYPE_LABELS: Record<RebindSource['type'], string> = {
  dashboard: 'Dashboards',
  analysis: 'Analyses',
};

async function listAudiences(search: string): Promise<RebindSource[]> {
  const params = { search: search || undefined, page: 1, pageSize: PAGE_SIZE };
  const [dashboards, analyses] = await Promise.all([
    assetsApi.getDashboardsPaginated(params),
    assetsApi.getAnalysesPaginated(params),
  ]);
  return [
    ...dashboards.dashboards.map((d) => ({ type: 'dashboard' as const, id: d.id, name: d.name })),
    ...analyses.analyses.map((a) => ({ type: 'analysis' as const, id: a.id, name: a.name })),
  ];
}

interface AudiencePickerProps {
  value: RebindSource | null;
  onChange: (audience: RebindSource | null) => void;
  disabled?: boolean;
  /** What happens with nothing chosen, for the helper text. */
  fallback: string;
}

export function AudiencePicker({
  value,
  onChange,
  disabled = false,
  fallback,
}: AudiencePickerProps) {
  const [input, setInput] = useState('');
  const search = useDebounce(input, SEARCH_DEBOUNCE_MS);
  const audiences = useQuery({
    queryKey: ['author-audiences', search],
    queryFn: () => listAudiences(search),
    staleTime: 60_000,
  });
  const options = audiences.data ?? [];
  const all = value && !options.some((o) => o.id === value.id) ? [value, ...options] : options;

  return (
    <Autocomplete<RebindSource>
      options={all}
      value={value}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      getOptionLabel={(o) => o.name}
      groupBy={(o) => TYPE_LABELS[o.type]}
      isOptionEqualToValue={(o, v) => o.id === v.id && o.type === v.type}
      filterOptions={(x) => x}
      loading={audiences.isLoading}
      disabled={disabled}
      size="small"
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {option.id}
              </Typography>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Audience from"
          placeholder="A dashboard or analysis whose readers this one gets"
          helperText={value ? `Same readers as "${value.name}"` : fallback}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <>
                  <Groups fontSize="small" sx={{ color: 'text.secondary', ml: 0.5, mr: 0.5 }} />
                  {params.slotProps.input.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {audiences.isLoading ? <CircularProgress size={16} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
