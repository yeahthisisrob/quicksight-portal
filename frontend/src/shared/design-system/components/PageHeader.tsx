import { Box, Chip, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** One line under the title saying what the page is for. */
  description?: ReactNode;
  /** A count shown as a badge next to the title. */
  counter?: number;
  /** @deprecated Use `counter`. */
  totalRows?: number;
  /** Primary actions on the right. */
  actions?: ReactNode;
  /** @deprecated Use `actions`. */
  extraActions?: ReactNode;
  /** Breadcrumbs or a back link above the title. */
  breadcrumbs?: ReactNode;
  /** Tabs or filters that belong to the header, rendered below it. */
  children?: ReactNode;
}

/**
 * The top of every page: a heading, an optional description, a counter, and
 * the page's primary actions on the right. Content-level headings belong on
 * Containers, not here.
 */
export function PageHeader({
  title,
  description,
  counter,
  totalRows,
  actions,
  extraActions,
  breadcrumbs,
  children,
}: PageHeaderProps) {
  const count = counter ?? totalRows;
  const right = actions ?? extraActions;
  return (
    <Box component="header" sx={{ mb: 2.5 }}>
      {breadcrumbs && <Box sx={{ mb: 1 }}>{breadcrumbs}</Box>}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography component="h1" variant="h2" sx={{ m: 0 }}>
              {title}
            </Typography>
            {count !== undefined && (
              <Chip label={count.toLocaleString()} size="small" variant="outlined" />
            )}
          </Box>
          {description && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
              {description}
            </Typography>
          )}
        </Box>
        {right && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>{right}</Box>
        )}
      </Box>
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}
