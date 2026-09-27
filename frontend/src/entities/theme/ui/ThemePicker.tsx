/**
 * Pick a theme: the account's own (with their colors) or one of
 * QuickSight's. Its value is what the API takes, a theme id or a built-in's
 * name.
 */
import { MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ColorSwatches } from '@/shared/ui';

import { useThemes } from '../model/useThemes';

export function ThemePicker({
  value,
  onChange,
  label = 'Theme',
  width = 280,
  size = 'small',
  emptyLabel,
}: {
  value: string;
  onChange: (themeId: string) => void;
  label?: string;
  width?: number;
  size?: 'small' | 'medium';
  /** Offer "no theme" under this label (its value is ''). */
  emptyLabel?: string;
}) {
  const { options, isLoading } = useThemes();
  const known = options.some((o) => o.id === value);
  return (
    <TextField
      select
      size={size}
      label={label}
      value={known || (emptyLabel && !value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      helperText={value && !known && !isLoading ? `${value} is not in the last export` : undefined}
      sx={{ width }}
      slotProps={{
        select: {
          renderValue: (id) => options.find((o) => o.id === id)?.name ?? emptyLabel ?? '',
          displayEmpty: Boolean(emptyLabel),
        },
        ...(emptyLabel ? { inputLabel: { shrink: true } } : {}),
      }}
    >
      {emptyLabel && (
        <MenuItem value="">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {emptyLabel}
          </Typography>
        </MenuItem>
      )}
      {options.map((o) => (
        <MenuItem key={o.id} value={o.id}>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {o.name}
            </Typography>
            {o.dataColors.length > 0 && <ColorSwatches colors={o.dataColors} size={10} max={10} />}
          </Stack>
        </MenuItem>
      ))}
    </TextField>
  );
}
