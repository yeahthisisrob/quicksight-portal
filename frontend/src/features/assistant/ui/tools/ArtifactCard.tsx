/**
 * How a large thing the assistant drew sits in the chat: a compact card of
 * fixed height (title, a one-line summary, who drew it, and a scaled-down
 * picture), and an Expand button that opens the full, interactive version
 * in a dialog. The card's height never depends on what loads into it, so
 * the conversation does not jump when a wireframe arrives.
 */
import { Close, OpenInFull } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';

import { pal } from '@/shared/design-system';

/** The picture's height in the card; with the header the card is about 260px. */
const PREVIEW_HEIGHT = 196;
const THUMB_SCALE = 0.5;

/**
 * Draws its children at twice the width and half the size: a whole
 * dashboard's layout reads at a glance. Inert, so nothing in it takes focus
 * or clicks; the card opens the real one.
 */
export function Thumbnail({
  children,
  scale = THUMB_SCALE,
}: {
  children: ReactNode;
  scale?: number;
}) {
  return (
    <Box
      aria-hidden
      inert
      sx={{
        width: `${100 / scale}%`,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </Box>
  );
}

/** A centred note inside the picture area while it loads or when it cannot draw. */
export function PreviewNote({ children }: { children: ReactNode }) {
  return (
    <Stack
      spacing={1}
      sx={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary',
        textAlign: 'center',
        px: 2,
      }}
    >
      {children}
    </Stack>
  );
}

function ModelChip({ label }: { label: string }) {
  return (
    <Tooltip title={`Drawn by ${label}`}>
      <Chip
        size="small"
        variant="outlined"
        label={label}
        sx={{ height: 20, fontSize: '0.6875rem', flexShrink: 0 }}
      />
    </Tooltip>
  );
}

interface ArtifactCardProps {
  icon: ReactNode;
  /** What kind of thing this is, e.g. "Preview · what it would publish". */
  kind: string;
  title: string;
  /** One line: what is in it. Truncated, never wraps. */
  summary?: ReactNode;
  /** Who drew it, when the artifact says. */
  model?: string | null;
  /** The compact picture, in an area of fixed height so the card never changes size. */
  preview: ReactNode;
  /**
   * For a picture whose size is known on its first render (a plan, a list):
   * the area shrinks to it, up to the same height. A picture that loads
   * keeps the fixed height, so nothing moves when it arrives.
   */
  fit?: boolean;
  /** The full version, rendered only while the dialog is open. */
  expanded: ReactNode;
}

/** Whether the picture is taller than its area, so the fade shows only when it clips. */
function useClipped(content: ReactNode) {
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  // Re-measured whenever the picture changes (loading, then drawn).
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setClipped(node.scrollHeight > node.clientHeight + 1);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    for (const child of Array.from(node.children)) observer.observe(child);
    observer.observe(node);
    return () => observer.disconnect();
  }, [content]);
  return { ref, clipped };
}

export function ArtifactCard({
  icon,
  kind,
  title,
  summary,
  model,
  preview,
  fit = false,
  expanded,
}: ArtifactCardProps) {
  const [open, setOpen] = useState(false);
  const { ref, clipped } = useClipped(preview);
  const titleId = useId();
  return (
    <Box
      data-testid="artifact-card"
      sx={(theme) => ({
        border: `1px solid ${pal(theme).line.default}`,
        borderRadius: `${Number(theme.shape.borderRadius) * 2}px`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        minWidth: 0,
      })}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 1.5, pt: 1.25 }}>
        <Box
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 1,
            color: pal(theme).brand.primary,
            bgcolor: pal(theme).brand.subtle,
            '& svg': { fontSize: 18 },
          })}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {title}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            noWrap
            sx={{ color: 'text.secondary', lineHeight: 1.4 }}
          >
            {kind}
            {summary ? ' · ' : ''}
            {summary}
          </Typography>
        </Box>
        {model && <ModelChip label={model} />}
        <Button
          size="small"
          variant="text"
          startIcon={<OpenInFull sx={{ fontSize: '16px !important' }} />}
          onClick={() => setOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Expand
        </Button>
      </Stack>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`Expand ${title}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        sx={(theme) => ({
          position: 'relative',
          height: fit ? 'auto' : PREVIEW_HEIGHT,
          maxHeight: PREVIEW_HEIGHT,
          m: 1.5,
          mt: 1.25,
          overflow: 'hidden',
          cursor: 'zoom-in',
          borderRadius: `${theme.shape.borderRadius}px`,
          border: `1px solid ${pal(theme).line.divider}`,
          bgcolor: pal(theme).surface.page,
          '&:hover': { borderColor: pal(theme).line.strong },
          '&:focus-visible': { outline: `2px solid ${pal(theme).line.focus}`, outlineOffset: 2 },
          // Content taller than the card fades out rather than ending on a cut.
          '&::after': clipped
            ? {
                content: '""',
                position: 'absolute',
                insetInline: 0,
                bottom: 0,
                height: 36,
                pointerEvents: 'none',
                background: `linear-gradient(to bottom, transparent, ${pal(theme).surface.page})`,
              }
            : {},
        })}
      >
        <Box
          ref={ref}
          sx={{
            p: 1.25,
            height: fit ? 'auto' : '100%',
            maxHeight: PREVIEW_HEIGHT,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {preview}
        </Box>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xl"
        fullWidth
        aria-labelledby={titleId}
        slotProps={{ paper: { sx: { height: '90vh', backgroundImage: 'none' } } }}
      >
        <DialogTitle id={titleId} sx={{ pr: 7 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Box sx={{ display: 'flex', color: 'primary.main' }}>{icon}</Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" component="span" noWrap sx={{ display: 'block' }}>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {kind}
                {summary ? ' · ' : ''}
                {summary}
              </Typography>
            </Box>
            {model && <ModelChip label={model} />}
          </Stack>
          <IconButton
            aria-label="Close"
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {open && expanded}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
