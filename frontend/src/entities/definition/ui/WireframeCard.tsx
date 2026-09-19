/**
 * One element on the wireframe canvas: a white card with a header, a dashed
 * placeholder where the chart would be, and the field wells as chips.
 *
 * The card can also carry what changed about it (moved, retyped, added,
 * removed), a health badge (slow, errors) and a selected state, so the same
 * drawing serves the read-only viewer, the before/after mockup and the
 * editor.
 */
import { ErrorOutlined, VisibilityOff, WarningAmber } from '@mui/icons-material';
import { alpha, Box, Chip, Tooltip, Typography } from '@mui/material';
import type { KeyboardEvent } from 'react';

import { borderRadius, typography } from '@/shared/design-system/theme';

import type { ElementChange, FieldRename } from '../lib/wireframeDiff';
import type { WireframeBadge, WireframeElement, WireframeField } from '../model/types';
import { glyphFor, kindLabel } from './glyphs';

const MAX_CHIPS_PER_WELL = 5;

export function fieldLabel(field: WireframeField): string {
  if (field.aggregation) return `${field.aggregation}(${field.label})`;
  if (field.granularity) return `${field.label} · ${field.granularity}`;
  return field.label;
}

/** Renames for this element, keyed `role/index` (see elementRenames). */
export type ElementRenames = Map<string, FieldRename>;

/** "BarChart" -> "bar chart", for chips. */
function typeWords(type: string | undefined): string {
  return (type ?? 'visual').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function changeLabel(change: ElementChange): { label: string; title: string } {
  switch (change.kind) {
    case 'retyped':
      return {
        label: `${typeWords(change.from)} → ${typeWords(change.to)}`,
        title: 'Visual type changed; axis, legend and sort settings reset',
      };
    case 'moved':
      return { label: 'moved', title: `Moved from ${change.from ?? '?'} to ${change.to}` };
    case 'resized':
      return { label: 'resized', title: `Resized from ${change.from ?? '?'} to ${change.to}` };
    case 'added':
      return { label: 'added', title: 'New in this version' };
    case 'removed':
      return { label: 'removed', title: 'Not in the result' };
  }
}

function Wells({ element, renames }: { element: WireframeElement; renames?: ElementRenames }) {
  if (element.fieldWells.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1, pb: 1 }}>
      {element.fieldWells.map((well) => {
        const shown = well.fields.slice(0, MAX_CHIPS_PER_WELL);
        const overflow = well.fields.length - shown.length;
        return (
          <Box
            key={well.role}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.625rem',
                mr: 0.25,
              }}
            >
              {well.role}
            </Typography>
            {shown.map((field, i) => {
              const rename = renames?.get(`${well.role}/${i}`);
              const qualified = field.dataSetIdentifier
                ? `${field.dataSetIdentifier}.${field.label}`
                : '';
              return (
                <Tooltip
                  key={`${field.label}-${i}`}
                  title={rename ? `Renamed: ${rename.from} → ${rename.to}` : qualified}
                >
                  <Chip
                    label={fieldLabel(field)}
                    size="small"
                    variant={rename ? 'filled' : 'outlined'}
                    color={rename ? 'info' : 'default'}
                    data-renamed={rename ? 'true' : undefined}
                    sx={{
                      height: 18,
                      fontSize: '0.6875rem',
                      fontFamily: typography.fontFamily.monospace,
                      fontWeight: rename ? typography.fontWeight.semibold : undefined,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                </Tooltip>
              );
            })}
            {overflow > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                +{overflow}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function Placeholder({ element }: { element: WireframeElement }) {
  const Glyph = glyphFor(element);
  const isControl = element.kind === 'filterControl' || element.kind === 'parameterControl';

  if (element.kind === 'textBox') {
    return (
      <Box sx={{ flex: 1, px: 1.5, py: 1, overflow: 'hidden', minHeight: 0 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          {element.title ?? 'Empty text box'}
        </Typography>
      </Box>
    );
  }

  if (isControl) {
    return (
      <Box sx={{ px: 1, pb: 1, pt: 0.5 }}>
        <Box
          sx={{
            height: 26,
            borderRadius: `${borderRadius.sm}px`,
            border: 1,
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
            display: 'flex',
            alignItems: 'center',
            px: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Select…
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 32,
        mx: 1,
        mb: element.fieldWells.length ? 0.75 : 1,
        borderRadius: `${borderRadius.sm}px`,
        border: '1px dashed',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: (t) => alpha(t.palette.text.primary, 0.12),
        overflow: 'hidden',
      }}
    >
      <Glyph sx={{ fontSize: 40, maxHeight: '70%' }} />
    </Box>
  );
}

export interface WireframeCardProps {
  element: WireframeElement;
  /** Control-bar rendering: tighter, no placeholder area. */
  dense?: boolean;
  /** Fields to draw as renamed, keyed `role/index`. */
  renames?: ElementRenames;
  /** What changed about this element versus the version it was derived from. */
  changes?: ElementChange[];
  /** A health warning from QuickSight metrics. */
  badge?: WireframeBadge;
  /** Editor selection. */
  selected?: boolean;
  /** Makes the card clickable (and keyboard-focusable). */
  onSelect?: () => void;
}

export function WireframeCard({
  element,
  dense = false,
  renames,
  changes,
  badge,
  selected = false,
  onSelect,
}: WireframeCardProps) {
  const Glyph = glyphFor(element);
  const isText = element.kind === 'textBox';
  const heading = isText ? undefined : (element.title ?? `Untitled ${kindLabel(element)}`);
  const removed = changes?.some((c) => c.kind === 'removed') ?? false;
  const emphasised = changes?.some((c) => c.kind !== 'removed') ?? false;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <Box
      data-testid={`wireframe-element-${element.id}`}
      data-selected={selected ? 'true' : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? onKeyDown : undefined}
      aria-pressed={onSelect ? selected : undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        bgcolor: 'background.paper',
        border: selected ? 2 : 1,
        borderStyle: removed ? 'dashed' : 'solid',
        borderColor: selected
          ? 'primary.main'
          : removed
            ? 'error.main'
            : emphasised
              ? 'info.main'
              : 'divider',
        borderRadius: `${borderRadius.sm}px`,
        overflow: 'hidden',
        opacity: removed ? 0.5 : 1,
        cursor: onSelect ? 'pointer' : undefined,
        boxShadow: (t) =>
          selected
            ? `0 0 0 3px ${alpha(t.palette.primary.main, 0.2)}`
            : `0 1px 2px ${alpha(t.palette.common.black, 0.04)}`,
        transition: 'border-color 120ms, box-shadow 120ms',
        '&:hover': onSelect ? { borderColor: selected ? 'primary.main' : 'text.secondary' } : {},
        '&:focus-visible': { outline: 'none', borderColor: 'primary.main' },
      }}
    >
      {(heading || badge || changes) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            pt: dense ? 0.5 : 0.75,
            pb: element.subtitle ? 0 : dense ? 0.25 : 0.5,
            minWidth: 0,
            opacity: element.titleHidden ? 0.55 : 1,
          }}
        >
          {heading && (
            <>
              <Tooltip title={kindLabel(element)}>
                <Glyph sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              </Tooltip>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontWeight: typography.fontWeight.medium,
                  fontStyle: element.title ? 'normal' : 'italic',
                  color: element.title ? 'text.primary' : 'text.secondary',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {heading}
              </Typography>
            </>
          )}
          {!heading && <Box sx={{ flex: 1 }} />}
          {changes?.map((change) => {
            const { label, title } = changeLabel(change);
            return (
              <Tooltip key={change.kind} title={title}>
                <Chip
                  label={label}
                  size="small"
                  color={change.kind === 'removed' ? 'error' : 'info'}
                  variant={
                    change.kind === 'moved' || change.kind === 'resized' ? 'outlined' : 'filled'
                  }
                  data-change={change.kind}
                  sx={{ height: 18, fontSize: '0.625rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              </Tooltip>
            );
          })}
          {badge && (
            <Tooltip title={badge.label}>
              <Chip
                icon={
                  badge.kind === 'error' ? (
                    <ErrorOutlined sx={{ fontSize: 14 }} />
                  ) : (
                    <WarningAmber sx={{ fontSize: 14 }} />
                  )
                }
                label={badge.kind === 'error' ? 'errors' : 'slow'}
                size="small"
                color={badge.kind === 'error' ? 'error' : 'warning'}
                variant="outlined"
                data-badge={badge.kind}
                sx={{ height: 18, fontSize: '0.625rem', '& .MuiChip-label': { px: 0.5 } }}
              />
            </Tooltip>
          )}
          {element.titleHidden && (
            <Tooltip title="Title hidden in QuickSight">
              <VisibilityOff sx={{ fontSize: 14, color: 'text.disabled' }} />
            </Tooltip>
          )}
        </Box>
      )}
      {element.subtitle && (
        <Typography variant="caption" noWrap sx={{ px: 1, pb: 0.5, color: 'text.secondary' }}>
          {element.subtitle}
        </Typography>
      )}
      {!dense && <Placeholder element={element} />}
      <Wells element={element} renames={renames} />
    </Box>
  );
}
