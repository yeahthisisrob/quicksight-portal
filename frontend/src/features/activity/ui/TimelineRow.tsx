/**
 * One event on the rail, or one burst of them. A row reads as a sentence:
 * who, did what, to which asset, from where, when. A burst row says how
 * many times and over what span, and opens to its events.
 */
import {
  DynamicFeed as BatchIcon,
  Add as CreateIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  Lock as GrantIcon,
  PlayArrow as JobIcon,
  DataObject as JsonIcon,
  GroupAdd as MemberIcon,
  OpenInNew as OpenInNewIcon,
  HelpOutlined as OtherIcon,
  Publish as PublishIcon,
  LockOpen as RevokeIcon,
  type SvgIconComponent,
  LocalOffer as TagIcon,
  Edit as UpdateIcon,
} from '@mui/icons-material';
import { Box, Collapse, IconButton, Stack, type Theme, Tooltip, Typography } from '@mui/material';
import { format, formatDistanceToNow } from 'date-fns';
import { type MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { TimelineEvent } from '@/shared/api/modules/activity';
import { pal } from '@/shared/design-system';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';
import TypedChip, { type ChipType } from '@/shared/ui/TypedChip';

import { type TimelineGroup, timeSpan } from '../lib/timelineGroups';
import { ActorChip } from './ActorChip';
import { OriginBadge } from './OriginBadge';
import { TimelineEventJsonDialog } from './TimelineEventJsonDialog';

/* ───────── Action → icon / colour / verb ───────────────────────────────── */

const ACTION_ICONS: Record<string, SvgIconComponent> = {
  create: CreateIcon,
  update: UpdateIcon,
  delete: DeleteIcon,
  publish: PublishIcon,
  grant: GrantIcon,
  revoke: RevokeIcon,
  member: MemberIcon,
  tag: TagIcon,
  job: JobIcon,
  batch: BatchIcon,
};

/** The rail dot colour per action, from the design tokens. */
export function actionColour(theme: Theme, action: string | undefined): string {
  const p = pal(theme);
  switch (action) {
    case 'create':
      return p.tone.success.text;
    case 'update':
      return p.tone.info.text;
    case 'delete':
      return p.tone.error.text;
    case 'publish':
      return p.brand.primary;
    case 'grant':
    case 'revoke':
      return p.tone.warning.text;
    case 'member':
      return p.asset.group.main;
    case 'tag':
      return p.asset.folder.main;
    default:
      return p.text.muted;
  }
}

const ACTION_VERBS: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  publish: 'published',
  grant: 'changed permissions on',
  revoke: 'revoked permissions on',
  member: 'updated membership of',
  tag: 'tagged',
  job: 'started a job on',
  batch: 'bulk-updated',
};

const RESOURCE_TYPE_TO_CHIP: Record<string, ChipType> = {
  dashboard: 'DASHBOARD',
  analysis: 'ANALYSIS',
  dataset: 'DATASET',
  datasource: 'DATASOURCE',
  folder: 'FOLDER',
  user: 'USER',
  group: 'GROUP',
};

const DOT_SIZE = 26;
const DOT_ICON_SIZE = 14;
const RAIL_WIDTH = 40;
const SMALL_ICON = 14;

function formatEventName(eventName: string): string {
  return eventName.replace(/([A-Z])/g, ' $1').trim();
}

function verbFor(event: TimelineEvent): string {
  return ACTION_VERBS[event.action ?? ''] ?? formatEventName(event.eventName);
}

function verbsFor(group: TimelineGroup): string {
  const verbs = group.actions.map((a) => ACTION_VERBS[a] ?? formatEventName(a));
  if (verbs.length <= 2) {
    return verbs.join(' and ');
  }
  return `${verbs.slice(0, -1).join(', ')} and ${verbs[verbs.length - 1]}`;
}

/* ───────── Pieces ───────────────────────────────────────────────────────── */

function RailDot({ action, connect }: { action: string | undefined; connect: boolean }) {
  const Icon = ACTION_ICONS[action ?? ''] ?? OtherIcon;
  return (
    <Box
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        alignSelf: 'stretch',
      }}
    >
      <Box
        sx={(theme) => ({
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: pal(theme).text.inverse,
          backgroundColor: actionColour(theme, action),
          flexShrink: 0,
        })}
      >
        <Icon sx={{ fontSize: DOT_ICON_SIZE }} />
      </Box>
      {connect && (
        <Box
          sx={(theme) => ({
            flex: 1,
            width: 2,
            mt: 0.5,
            backgroundColor: pal(theme).line.divider,
          })}
        />
      )}
    </Box>
  );
}

function AssetLink({ event }: { event: TimelineEvent }) {
  const navigate = useNavigate();
  const isCatalogAsset = event.resourceType && event.resourceType !== 'other' && event.assetType;
  const chipType = isCatalogAsset ? RESOURCE_TYPE_TO_CHIP[event.resourceType!] : undefined;
  const label = event.assetName || event.assetId || formatEventName(event.eventName);
  if (!chipType) {
    return (
      <Typography component="span" variant="body2" sx={{ fontStyle: 'italic' }}>
        {label}
      </Typography>
    );
  }
  return (
    <TypedChip
      type={chipType}
      customLabel={label}
      size="small"
      onClick={() =>
        navigate(`/assets/${event.assetType}s/${encodeURIComponent(event.assetId ?? '')}`)
      }
      sx={{ cursor: 'pointer' }}
    />
  );
}

function RowActions({ event }: { event: TimelineEvent }) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const quicksightUrl =
    event.assetType && event.assetId
      ? getQuickSightConsoleUrl(event.assetType, event.assetId)
      : null;
  const open = (e: MouseEvent) => {
    e.stopPropagation();
    if (quicksightUrl) {
      window.open(quicksightUrl, '_blank', 'noopener,noreferrer');
    }
  };
  return (
    <>
      {quicksightUrl && (
        <Tooltip title="Open in QuickSight">
          <IconButton size="small" onClick={open} sx={{ p: 0.25, color: 'text.secondary' }}>
            <OpenInNewIcon sx={{ fontSize: SMALL_ICON }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Stored event JSON">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setJsonOpen(true);
          }}
          sx={{ p: 0.25, color: 'text.secondary' }}
        >
          <JsonIcon sx={{ fontSize: SMALL_ICON }} />
        </IconButton>
      </Tooltip>
      <TimelineEventJsonDialog open={jsonOpen} onClose={() => setJsonOpen(false)} event={event} />
    </>
  );
}

function When({ iso, children }: { iso: string; children?: string }) {
  const date = new Date(iso);
  return (
    <Tooltip title={format(date, 'PPpp')}>
      <Typography
        variant="caption"
        sx={(theme) => ({
          color: pal(theme).text.secondary,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        {children ?? formatDistanceToNow(date, { addSuffix: true })}
      </Typography>
    </Tooltip>
  );
}

/* ───────── Rows ─────────────────────────────────────────────────────────── */

export interface TimelineRowProps {
  event: TimelineEvent;
  /** Draw the rail line down to the next row. */
  connect?: boolean;
  /** Inside an opened burst: no actor, since the burst row named it. */
  nested?: boolean;
}

export function TimelineRow({ event, connect = true, nested = false }: TimelineRowProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={(theme) => ({
        px: 2,
        py: nested ? 0.5 : 1,
        '&:hover': { backgroundColor: pal(theme).surface.hover },
      })}
    >
      <RailDot action={event.action} connect={connect} />
      <Box
        sx={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flexWrap: 'wrap',
        }}
      >
        {!nested && <ActorChip event={event} />}
        <Typography
          component="span"
          variant="body2"
          sx={(theme) => ({ color: pal(theme).text.secondary })}
        >
          {verbFor(event)}
        </Typography>
        <AssetLink event={event} />
        {!nested && <OriginBadge origin={event.origin} />}
        <Typography
          component="span"
          variant="caption"
          sx={(theme) => ({ color: pal(theme).text.muted, fontFamily: 'monospace' })}
        >
          {event.eventName}
        </Typography>
        <RowActions event={event} />
      </Box>
      <When iso={event.timestamp}>
        {nested ? format(new Date(event.timestamp), 'HH:mm:ss') : undefined}
      </When>
    </Stack>
  );
}

export interface TimelineGroupRowProps {
  group: TimelineGroup;
  connect?: boolean;
}

/** A burst: one row that says how many and over what span, opening to the events. */
export function TimelineGroupRow({ group, connect = true }: TimelineGroupRowProps) {
  const [open, setOpen] = useState(false);
  if (group.events.length === 1) {
    return <TimelineRow event={group.lead} connect={connect} />;
  }
  const { lead } = group;
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        sx={(theme) => ({
          px: 2,
          py: 1,
          cursor: 'pointer',
          '&:hover': { backgroundColor: pal(theme).surface.hover },
        })}
      >
        <RailDot action={lead.action} connect={connect || open} />
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexWrap: 'wrap',
          }}
        >
          <ActorChip event={lead} />
          <Typography
            component="span"
            variant="body2"
            sx={(theme) => ({ color: pal(theme).text.secondary })}
          >
            {verbsFor(group)}
          </Typography>
          <AssetLink event={lead} />
          <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
            {group.events.length} times
          </Typography>
          <Typography
            component="span"
            variant="caption"
            sx={(theme) => ({ color: pal(theme).text.secondary })}
          >
            · {timeSpan(group)}
          </Typography>
          <OriginBadge origin={lead.origin} />
          <IconButton
            size="small"
            aria-label={open ? 'Collapse' : 'Expand'}
            sx={{
              p: 0.25,
              ml: 'auto',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 120ms',
            }}
          >
            <ExpandIcon fontSize="small" />
          </IconButton>
        </Box>
        <When iso={lead.timestamp} />
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pl: 3 }}>
          {group.events.map((event, index) => (
            <TimelineRow
              key={event.id}
              event={event}
              nested
              connect={connect || index < group.events.length - 1}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
