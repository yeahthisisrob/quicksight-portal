/**
 * Key-value pairs, the way a console summarises a resource: small muted
 * label above, value below, laid out in responsive columns.
 */
import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface KeyValueItem {
  label: string;
  value: ReactNode;
}

interface KeyValueListProps {
  items: KeyValueItem[];
  columns?: number;
}

export function KeyValueList({ items, columns = 3 }: KeyValueListProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: `repeat(${Math.min(columns, 2)}, 1fr)`,
          md: `repeat(${columns}, 1fr)`,
        },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            component="div"
            sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.25 }}
          >
            {item.label}
          </Typography>
          <Typography variant="body2" component="div" sx={{ wordBreak: 'break-word' }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
