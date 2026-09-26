/**
 * Markdown as the design system draws text: what a model writes (bold,
 * lists, code, short tables, links) rendered with MUI typography rather
 * than shown as raw asterisks and backticks. Raw HTML is never rendered.
 * Links inside the portal stay in the tab; outside links open a new one.
 */
import { Box, Link, Typography } from '@mui/material';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { pal } from '@/shared/design-system';

const components: Components = {
  p: ({ children }) => (
    <Typography variant="body2" component="p" sx={{ m: 0, '& + &': { mt: 1 } }}>
      {children}
    </Typography>
  ),
  h1: ({ children }) => (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2', '& li + li': { mt: 0.25 } }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ m: 0, pl: 2.5, typography: 'body2', '& li + li': { mt: 0.25 } }}>
      {children}
    </Box>
  ),
  li: ({ children }) => <li>{children}</li>,
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
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <Box
        component="code"
        sx={(theme) => ({
          fontFamily: 'monospace',
          fontSize: '0.85em',
          px: 0.5,
          py: 0.125,
          borderRadius: 0.5,
          bgcolor: pal(theme).surface.container,
        })}
      >
        {children}
      </Box>
    ),
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={(theme) => ({
        m: 0,
        p: 1,
        fontSize: 12,
        fontFamily: 'monospace',
        overflowX: 'auto',
        borderRadius: 1,
        bgcolor: pal(theme).surface.container,
      })}
    >
      {children}
    </Box>
  ),
  table: ({ children }) => (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={(theme) => ({
          borderCollapse: 'collapse',
          typography: 'body2',
          '& th, & td': {
            border: `1px solid ${pal(theme).line.divider}`,
            px: 1,
            py: 0.5,
            textAlign: 'left',
          },
          '& th': { fontWeight: 700, bgcolor: pal(theme).surface.container },
        })}
      >
        {children}
      </Box>
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={(theme) => ({
        m: 0,
        pl: 1.5,
        borderLeft: `3px solid ${pal(theme).line.divider}`,
        color: 'text.secondary',
      })}
    >
      {children}
    </Box>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere', '& > * + *': { mt: 1 } }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </Box>
  );
}
