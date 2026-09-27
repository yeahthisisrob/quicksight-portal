/**
 * What a theme looks like on a sheet: its background, a title in its
 * foreground, a bar chart in its data colors and a button in its accent.
 * A sketch, not QuickSight's renderer, so a draft can be judged at a glance.
 */
import { Box, Stack, Typography } from '@mui/material';

import type { ThemeDraft } from '@/shared/api/modules/themes';

const BAR_HEIGHTS = [72, 48, 88, 36, 64, 54, 80, 42];

/** What each built-in base looks like where the draft leaves a role unset. */
const BASE_DEFAULTS: Record<string, { bg: string; fg: string; card: string }> = {
  CLASSIC: { bg: '#FFFFFF', fg: '#1B1B1B', card: '#F4F4F4' },
  MIDNIGHT: { bg: '#1B1B1B', fg: '#EEEEEE', card: '#2A2A2A' },
  SEASIDE: { bg: '#F2F7FA', fg: '#0B2A3A', card: '#FFFFFF' },
  RAINIER: { bg: '#F7F7F2', fg: '#222222', card: '#FFFFFF' },
};

export function ThemePreview({ draft }: { draft: ThemeDraft }) {
  const base = BASE_DEFAULTS[draft.baseThemeId ?? 'CLASSIC'] ?? BASE_DEFAULTS.CLASSIC!;
  const ui = draft.uiColors ?? {};
  const bg = ui.PrimaryBackground ?? base.bg;
  const fg = ui.PrimaryForeground ?? base.fg;
  const card = ui.SecondaryBackground ?? base.card;
  const cardFg = ui.SecondaryForeground ?? fg;
  const accent = ui.Accent ?? draft.dataColors[0] ?? '#1F77B4';
  const accentFg = ui.AccentForeground ?? '#FFFFFF';
  const colors = draft.dataColors.length ? draft.dataColors : ['#999999'];

  return (
    <Box
      sx={{
        bgcolor: bg,
        color: fg,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        p: 2,
        fontFamily: draft.fontFamily || undefined,
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
      >
        <Typography sx={{ fontWeight: 600, fontFamily: 'inherit', color: fg }}>
          {draft.name || 'Untitled theme'}
        </Typography>
        <Box
          sx={{
            bgcolor: accent,
            color: accentFg,
            px: 1.25,
            py: 0.25,
            borderRadius: 0.5,
            fontSize: 12,
          }}
        >
          Filter
        </Box>
      </Stack>
      <Box sx={{ bgcolor: card, color: cardFg, borderRadius: 1, p: 1.5 }}>
        <Typography variant="caption" sx={{ fontFamily: 'inherit', color: cardFg }}>
          Revenue by region
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end', height: 96, mt: 1 }}>
          {BAR_HEIGHTS.map((h, i) => (
            <Box
              key={h * (i + 1)}
              sx={{ flex: 1, height: h, bgcolor: colors[i % colors.length], borderRadius: 0.5 }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
