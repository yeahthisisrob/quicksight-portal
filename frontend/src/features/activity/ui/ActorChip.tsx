/**
 * Who did it, in words. The portal shows as "Portal" with, when the audit
 * log knows, the person or the API key behind it; people show as their
 * name; roles as "Role / person". The raw actor string lives in the tooltip.
 */
import {
  SmartToy as AgentIcon,
  Hub as PortalIcon,
  AdminPanelSettings as RoleIcon,
  Shield as RootIcon,
  Cloud as ServiceIcon,
  type SvgIconComponent,
  HelpOutlined as UnknownIcon,
  Person as UserIcon,
} from '@mui/icons-material';
import { Box, Tooltip, Typography } from '@mui/material';

import type { TimelineEvent } from '@/shared/api/modules/activity';
import { pal } from '@/shared/design-system';

import { type ActorIconKind, actorDisplay } from '../lib/actorDisplay';

const ICONS: Record<ActorIconKind, SvgIconComponent> = {
  portal: PortalIcon,
  agent: AgentIcon,
  user: UserIcon,
  role: RoleIcon,
  root: RootIcon,
  service: ServiceIcon,
  unknown: UnknownIcon,
};

const ICON_SIZE = 16;

export interface ActorChipProps {
  event: TimelineEvent;
  /** Compact: icon and primary label only; the "via" part moves to the tooltip. */
  compact?: boolean;
}

export function ActorChip({ event, compact = false }: ActorChipProps) {
  const shown = actorDisplay(event);
  const Icon = ICONS[shown.icon];
  const tooltipLines = [...shown.tooltip];
  if (compact && shown.via) {
    tooltipLines.unshift(`via ${shown.via}`);
  }
  const tooltip = tooltipLines.length ? (
    <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
      {tooltipLines.join('\n')}
    </Box>
  ) : (
    ''
  );

  return (
    <Tooltip title={tooltip}>
      <Box
        component="span"
        sx={(theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          minWidth: 0,
          color: shown.icon === 'agent' ? pal(theme).tone.success.text : pal(theme).text.primary,
        })}
      >
        <Icon sx={{ fontSize: ICON_SIZE, flexShrink: 0 }} />
        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {shown.label}
        </Typography>
        {!compact && shown.via && (
          <Typography
            component="span"
            variant="body2"
            sx={(theme) => ({ color: pal(theme).text.secondary })}
            noWrap
          >
            · {shown.via}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
