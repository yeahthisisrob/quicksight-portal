/**
 * A reply's text part, as markdown: assistant-ui's MarkdownTextPrimitive
 * (reads the part, reveals it smoothly) drawn with the design system's
 * markdown elements and styles, GitHub tables and task lists included.
 * Fenced code gets a header with its language and a copy button.
 */

import type { CodeHeaderProps } from '@assistant-ui/react-markdown';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { Check, ContentCopy } from '@mui/icons-material';
import { Box, IconButton, styled, Tooltip, Typography } from '@mui/material';
import { memo, useState } from 'react';

import { pal } from '@/shared/design-system';
import { markdownComponents, markdownSx, remarkPlugins } from '@/shared/ui';

const COPIED_MS = 1_500;

function CodeHeader({ language, code }: CodeHeaderProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_MS);
    });
  };
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        py: 0.25,
        border: `1px solid ${pal(theme).line.divider}`,
        borderBottom: 0,
        borderRadius: `${Number(theme.shape.borderRadius) * 1.5}px ${Number(theme.shape.borderRadius) * 1.5}px 0 0`,
        bgcolor: pal(theme).surface.selected,
        // Doubled class: outranks the markdown's spacing between blocks.
        '&& + pre': { borderTopLeftRadius: 0, borderTopRightRadius: 0, mt: 0 },
      })}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {language || 'text'}
      </Typography>
      <Tooltip title={copied ? 'Copied' : 'Copy'}>
        <IconButton size="small" onClick={copy} aria-label="Copy code">
          {copied ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

const components = { ...markdownComponents, CodeHeader };

/** The primitive's own container, styled as the design system's markdown. */
const MarkdownRoot = styled('div')(({ theme }) => theme.unstable_sx(markdownSx(theme)));

function MarkdownTextImpl() {
  return (
    <MarkdownTextPrimitive
      containerComponent={MarkdownRoot}
      remarkPlugins={remarkPlugins}
      components={components}
      skipHtml
      smooth={false}
    />
  );
}

export const MarkdownText = memo(MarkdownTextImpl);
