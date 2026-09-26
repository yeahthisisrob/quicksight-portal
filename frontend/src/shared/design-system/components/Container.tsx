import { Box, type SxProps, type Theme, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { pal } from '../createAppTheme';
import { radius } from '../tokens/scale';

interface ContainerProps {
  /** A string becomes an h2 heading; a node is rendered as given. */
  header?: ReactNode;
  /** Explanatory text under the heading. */
  description?: ReactNode;
  /** Buttons and controls on the right of the header row. */
  actions?: ReactNode;
  /** A small counter or status next to the heading. */
  headerAdornment?: ReactNode;
  /** A footer strip below the content, separated by a divider. */
  footer?: ReactNode;
  /** Remove the content padding when the body is a table or canvas. */
  disableContentPadding?: boolean;
  /** Stretch to the parent's height with the content scrolling. */
  fitHeight?: boolean;
  variant?: 'default' | 'subtle';
  sx?: SxProps<Theme>;
  children?: ReactNode;
  /** The heading level for a string header. */
  headingLevel?: 'h2' | 'h3';
}

/**
 * The basic surface everything sits on: a white card with a 1px border, a
 * 16px radius and an optional header row. Nest sections inside one page as
 * separate Containers rather than dividing one with rules.
 */
export function Container({
  header,
  description,
  actions,
  headerAdornment,
  footer,
  disableContentPadding = false,
  fitHeight = false,
  variant = 'default',
  sx,
  children,
  headingLevel = 'h2',
}: ContainerProps) {
  const hasHeader = Boolean(header || description || actions);
  return (
    <Box
      sx={[
        (theme) => ({
          backgroundColor:
            variant === 'subtle' ? pal(theme).surface.hover : pal(theme).surface.container,
          border: `1px solid ${pal(theme).line.default}`,
          borderRadius: `${radius.container}px`,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          ...(fitHeight ? { height: '100%', minHeight: 0 } : {}),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {hasHeader && (
        <Box
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            px: 2.5,
            pt: 2,
            pb: 1.5,
            borderBottom: `1px solid ${pal(theme).line.divider}`,
          })}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {typeof header === 'string' ? (
                <Typography
                  component={headingLevel}
                  variant={headingLevel === 'h2' ? 'h4' : 'h5'}
                  sx={{ m: 0 }}
                >
                  {header}
                </Typography>
              ) : (
                header
              )}
              {headerAdornment}
            </Box>
            {description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                {description}
              </Typography>
            )}
          </Box>
          {actions && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              {actions}
            </Box>
          )}
        </Box>
      )}
      <Box
        sx={{
          p: disableContentPadding ? 0 : 2.5,
          flex: fitHeight ? 1 : 'initial',
          minHeight: 0,
          overflow: fitHeight ? 'auto' : 'visible',
        }}
      >
        {children}
      </Box>
      {footer && (
        <Box
          sx={(theme) => ({
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${pal(theme).line.divider}`,
            backgroundColor: pal(theme).surface.hover,
            borderBottomLeftRadius: `${radius.container}px`,
            borderBottomRightRadius: `${radius.container}px`,
          })}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}
