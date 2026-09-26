/**
 * A coloured dot and a word: the quiet status pattern consoles use instead
 * of a loud chip. Colour is the theme's semantic palette.
 */
import { Box, CircularProgress, Typography } from '@mui/material';

type StatusKind = 'success' | 'info' | 'warning' | 'error' | 'pending' | 'loading';

interface StatusIndicatorProps {
  kind: StatusKind;
  children: React.ReactNode;
}

const DOT = 8;

export function StatusIndicator({ kind, children }: StatusIndicatorProps) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      {kind === 'loading' ? (
        <CircularProgress size={12} thickness={5} />
      ) : (
        <Box
          sx={{
            width: DOT,
            height: DOT,
            borderRadius: '50%',
            flexShrink: 0,
            bgcolor: (t) => (kind === 'pending' ? t.palette.text.disabled : t.palette[kind].main),
          }}
        />
      )}
      <Typography
        variant="body2"
        component="span"
        sx={{
          color: (t) =>
            kind === 'pending' || kind === 'loading'
              ? t.palette.text.secondary
              : t.palette[kind].dark,
          fontWeight: 500,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}
