/**
 * Markdown as the design system draws text: what a model writes (bold,
 * lists, code, tables, links) rendered with MUI typography rather than
 * shown as raw asterisks and backticks. Raw HTML is never rendered. Links
 * inside the portal stay in the tab; outside links open a new one.
 *
 * The element map (`markdownComponents`) and the container styles
 * (`markdownSx`) are exported so a renderer with its own markdown pipeline
 * (the assistant's streaming text) draws exactly the same way. Code is
 * styled from the container, so inline code and fenced blocks look right
 * whichever pipeline decides which is which.
 */
import { Box, Link, type SxProps, type Theme, Typography } from '@mui/material';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { pal } from '@/shared/design-system';
import { typography } from '@/shared/design-system/theme';

export const markdownComponents: Components = {
  p: ({ children }) => (
    <Typography variant="body2" component="p" sx={{ m: 0 }}>
      {children}
    </Typography>
  ),
  h1: ({ children }) => (
    <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle2" component="h5" sx={{ fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography variant="subtitle2" component="h6" sx={{ fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 700 }}>
      {children}
    </Box>
  ),
  a: ({ href, children }) => {
    const internal = typeof href === 'string' && href.startsWith('/');
    return (
      <Link href={href} {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
        {children}
      </Link>
    );
  },
  // Wide tables scroll inside the message instead of widening it.
  table: ({ children }) => (
    <Box className="md-table">
      <table>{children}</table>
    </Box>
  ),
};

const MONO = typography.fontFamily.monospace;

/** One style object, as `sx` takes it (not a callback or an array). */
type StyleObject = Exclude<
  SxProps<Theme>,
  ((...args: never[]) => unknown) | ReadonlyArray<unknown>
>;

/**
 * The container styles: spacing between blocks, lists, code, tables and
 * quotes. A function of the theme, so a host can nest it under a selector.
 */
export const markdownSx = (theme: Theme): StyleObject => {
  const p = pal(theme);
  return {
    minWidth: 0,
    overflowWrap: 'anywhere',
    typography: 'body2',
    // Blocks own no margins; the space between them is set here, in one place
    // (doubled class, so it outranks the elements' own styles).
    '&& > *': { mt: 0, mb: 0 },
    '&& > * + *': { mt: 1.25 },
    '&& > * + :is(h3, h4, h5, h6)': { mt: 2 },
    '& ul, & ol': { pl: 2.75 },
    '& li + li': { mt: 0.5 },
    '& li > ul, & li > ol': { mt: 0.5 },
    '& li::marker': { color: p.text.secondary },
    '& :not(pre) > code': {
      fontFamily: MONO,
      fontSize: '0.85em',
      px: 0.625,
      py: 0.125,
      borderRadius: 0.75,
      border: `1px solid ${p.line.divider}`,
      bgcolor: p.surface.hover,
    },
    '& pre': {
      mx: 0,
      px: 1.5,
      py: 1.25,
      fontFamily: MONO,
      fontSize: 12.5,
      lineHeight: 1.6,
      overflowX: 'auto',
      borderRadius: 1.5,
      border: `1px solid ${p.line.divider}`,
      bgcolor: p.surface.hover,
    },
    '& pre code': { fontFamily: 'inherit', fontSize: 'inherit', bgcolor: 'transparent' },
    '& .md-table': {
      overflowX: 'auto',
      maxWidth: '100%',
      border: `1px solid ${p.line.divider}`,
      borderRadius: 1.5,
    },
    '& .md-table table': {
      borderCollapse: 'collapse',
      width: '100%',
      fontVariantNumeric: 'tabular-nums',
    },
    '& .md-table th, & .md-table td': {
      px: 1.25,
      py: 0.75,
      textAlign: 'left',
      verticalAlign: 'top',
      borderBottom: `1px solid ${p.line.divider}`,
    },
    '& .md-table th': {
      fontWeight: 600,
      color: p.text.secondary,
      bgcolor: p.surface.hover,
      whiteSpace: 'nowrap',
    },
    '& .md-table tr:last-of-type td': { borderBottom: 0 },
    '& .md-table td[align="right"], & .md-table th[align="right"]': { textAlign: 'right' },
    '& blockquote': {
      mx: 0,
      pl: 1.5,
      borderLeft: `3px solid ${p.line.default}`,
      color: p.text.secondary,
    },
    '& hr': { border: 0, borderTop: `1px solid ${p.line.divider}` },
  };
};

export const remarkPlugins = [remarkGfm];

export function Markdown({ children }: { children: string }) {
  return (
    <Box sx={markdownSx}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents} skipHtml>
        {children}
      </ReactMarkdown>
    </Box>
  );
}
