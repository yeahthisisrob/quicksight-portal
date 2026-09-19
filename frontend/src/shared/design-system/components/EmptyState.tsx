import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { pal } from '../createAppTheme';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** A large icon above the title. */
  icon?: ReactNode;
  /** The one thing to do next, usually a Button. */
  action?: ReactNode;
  /** Tighter padding for use inside a table or a small container. */
  compact?: boolean;
}

/**
 * What a list shows instead of nothing. Says what would be here and what to
 * do about it; never just "No data".
 */
export function EmptyState({ title, description, icon, action, compact = false }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        py: compact ? 3 : 6,
        px: 3,
        gap: 1,
      }}
    >
      {icon && (
        <Box
          sx={(theme) => ({
            color: pal(theme).text.muted,
            mb: 0.5,
            '& svg': { fontSize: compact ? 32 : 40 },
          })}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h5" component="p">
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 440 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}

export default EmptyState;
