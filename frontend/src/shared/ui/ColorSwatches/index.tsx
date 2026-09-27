/**
 * A theme's colors as a strip of swatches, each named by its hex (and its
 * role, when it has one) on hover. Past `max` the rest are counted, so a
 * twenty-color palette fits a table cell.
 */
import { Box, Stack, Tooltip, Typography } from '@mui/material';

export interface Swatch {
  color: string;
  label?: string;
}

export function ColorSwatches({
  colors,
  size = 16,
  max = 12,
}: {
  colors: Array<string | Swatch>;
  size?: number;
  max?: number;
}) {
  const swatches = colors.map((c) => (typeof c === 'string' ? { color: c } : c));
  const shown = swatches.slice(0, max);
  const more = swatches.length - shown.length;
  if (swatches.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        No colors
      </Typography>
    );
  }
  return (
    <Stack
      direction="row"
      spacing={0.25}
      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.25 }}
    >
      {shown.map((s, i) => (
        <Tooltip key={`${s.color}-${i}`} title={s.label ? `${s.label} ${s.color}` : s.color}>
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: 0.5,
              bgcolor: s.color,
              border: 1,
              borderColor: 'divider',
              flexShrink: 0,
            }}
          />
        </Tooltip>
      ))}
      {more > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
          +{more}
        </Typography>
      )}
    </Stack>
  );
}
