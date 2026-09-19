/**
 * Where a change came from, as a small tinted badge: Portal (a person in
 * the UI), Agent (an API key), Console, Automation.
 */
import { Box, type Theme, Tooltip } from '@mui/material';

import { pal } from '@/shared/design-system';

import { ORIGIN_META, type TimelineOrigin } from '../lib/actorDisplay';

const BADGE_FONT_PX = 11;
const BADGE_RADIUS_PX = 4;

function colours(theme: Theme, origin: TimelineOrigin): { bg: string; fg: string; line: string } {
  const p = pal(theme);
  switch (ORIGIN_META[origin].tone) {
    case 'brand':
      return { bg: p.brand.subtle, fg: p.brand.primary, line: p.brand.subtle };
    case 'success':
      return { bg: p.tone.success.bg, fg: p.tone.success.text, line: p.tone.success.border };
    case 'info':
      return { bg: p.tone.info.bg, fg: p.tone.info.text, line: p.tone.info.border };
    case 'warning':
      return { bg: p.tone.warning.bg, fg: p.tone.warning.text, line: p.tone.warning.border };
    default:
      return { bg: p.surface.hover, fg: p.text.secondary, line: p.line.divider };
  }
}

export function OriginBadge({ origin }: { origin: TimelineOrigin }) {
  const meta = ORIGIN_META[origin];
  return (
    <Tooltip title={meta.description}>
      <Box
        component="span"
        sx={(theme) => {
          const c = colours(theme, origin);
          return {
            display: 'inline-flex',
            alignItems: 'center',
            px: 0.75,
            py: 0.125,
            borderRadius: `${BADGE_RADIUS_PX}px`,
            fontSize: BADGE_FONT_PX,
            fontWeight: 600,
            lineHeight: 1.6,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            backgroundColor: c.bg,
            color: c.fg,
            border: `1px solid ${c.line}`,
            whiteSpace: 'nowrap',
          };
        }}
      >
        {meta.label}
      </Box>
    </Tooltip>
  );
}
