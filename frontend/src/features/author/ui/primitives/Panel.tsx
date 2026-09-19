/**
 * Panel - the container pattern the Author page is built from.
 *
 * A white surface on the grey page, a header row (title, optional
 * description, actions on the right), then content. Every colour is a theme
 * token so the panel follows whatever theme the app runs under.
 */
import { alpha, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

const RADIUS = 16;

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** No inner padding; the content draws edge to edge (tables, canvases). */
  flush?: boolean;
  children: ReactNode;
  sx?: object;
}

export function Panel({ title, description, actions, flush = false, children, sx }: PanelProps) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${RADIUS}px`,
        boxShadow: (t) => `0 1px 2px ${alpha(t.palette.common.black, 0.04)}`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...sx,
      }}
    >
      {(title || actions) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            px: 2.5,
            pt: 2,
            pb: description ? 1.5 : 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                {title}
              </Typography>
            )}
            {description && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {description}
              </Typography>
            )}
          </Box>
          {actions && (
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
              {actions}
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ p: flush ? 0 : 2.5, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
