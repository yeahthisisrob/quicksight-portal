/**
 * One element on the wireframe canvas: a white card with a header, a dashed
 * placeholder where the chart would be, and the field wells as chips.
 */
import { VisibilityOff } from '@mui/icons-material';
import { alpha, Box, Chip, Tooltip, Typography } from '@mui/material';

import { borderRadius, typography } from '@/shared/design-system/theme';

import type { WireframeElement, WireframeField } from '../model/types';
import { glyphFor, kindLabel } from './glyphs';

const MAX_CHIPS_PER_WELL = 5;

export function fieldLabel(field: WireframeField): string {
  if (field.aggregation) return `${field.aggregation}(${field.label})`;
  if (field.granularity) return `${field.label} · ${field.granularity}`;
  return field.label;
}

function Wells({ element }: { element: WireframeElement }) {
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
            {shown.map((field, i) => (
              <Tooltip
                key={`${field.label}-${i}`}
                title={field.dataSetIdentifier ? `${field.dataSetIdentifier}.${field.label}` : ''}
              >
                <Chip
                  label={fieldLabel(field)}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 18,
                    fontSize: '0.6875rem',
                    fontFamily: typography.fontFamily.monospace,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Tooltip>
            ))}
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

interface WireframeCardProps {
  element: WireframeElement;
  /** Control-bar rendering: tighter, no placeholder area. */
  dense?: boolean;
}

export function WireframeCard({ element, dense = false }: WireframeCardProps) {
  const Glyph = glyphFor(element);
  const isText = element.kind === 'textBox';
  const heading = isText ? undefined : (element.title ?? `Untitled ${kindLabel(element)}`);

  return (
    <Box
      data-testid={`wireframe-element-${element.id}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${borderRadius.sm}px`,
        overflow: 'hidden',
        boxShadow: (t) => `0 1px 2px ${alpha(t.palette.common.black, 0.04)}`,
      }}
    >
      {heading && (
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
      <Wells element={element} />
    </Box>
  );
}
