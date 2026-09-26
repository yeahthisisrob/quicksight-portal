/**
 * Pick the QuickSight folder a copy is published into. Searches the
 * portal's folder list as you type; clearing it leaves the copy at the root.
 */
import { Folder } from '@mui/icons-material';
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { assetsApi } from '@/shared/api';
import { useDebounce } from '@/shared/lib/useDebounce';

import type { StudioFolder } from '../model/studio';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

async function listFolders(search: string): Promise<StudioFolder[]> {
  const result = await assetsApi.getFoldersPaginated({
    search: search || undefined,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  return result.folders.map((f) => ({ id: f.id, name: f.name, path: f.path }));
}

interface FolderPickerProps {
  value: StudioFolder | null;
  onChange: (folder: StudioFolder | null) => void;
  disabled?: boolean;
}

export function FolderPicker({ value, onChange, disabled = false }: FolderPickerProps) {
  const [input, setInput] = useState('');
  const search = useDebounce(input, SEARCH_DEBOUNCE_MS);
  const folders = useQuery({
    queryKey: ['author-folders', search],
    queryFn: () => listFolders(search),
    staleTime: 60_000,
  });
  const options = folders.data ?? [];
  // The chosen folder may not be in the current page of results.
  const all = value && !options.some((f) => f.id === value.id) ? [value, ...options] : options;

  return (
    <Autocomplete<StudioFolder>
      options={all}
      value={value}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next, reason) => {
        if (reason !== 'reset') {
          setInput(next);
        }
      }}
      getOptionLabel={(f) => f.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      loading={folders.isLoading}
      disabled={disabled}
      size="small"
      fullWidth
      noOptionsText={folders.error ? 'Folders could not be loaded' : 'No folders match'}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest} sx={{ gap: 1 }}>
            <Folder fontSize="small" sx={{ color: 'text.secondary' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {option.name}
              </Typography>
              {option.path && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {option.path}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Folder"
          placeholder="Search folders"
          helperText={value?.path ?? 'Leave empty to publish at the root'}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {folders.isLoading ? <CircularProgress size={16} /> : null}
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
