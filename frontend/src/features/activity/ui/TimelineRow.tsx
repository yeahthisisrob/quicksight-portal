import {
  Add as CreateIcon,
  Edit as UpdateIcon,
  Delete as DeleteIcon,
  Publish as PublishIcon,
  Lock as GrantIcon,
  LockOpen as RevokeIcon,
  GroupAdd as MemberIcon,
  LocalOffer as TagIcon,
  PlayArrow as JobIcon,
  DynamicFeed as BatchIcon,
  HelpOutline as OtherIcon,
  type SvgIconComponent,
} from '@mui/icons-material';
import { Avatar, Box, Stack, Tooltip, Typography } from '@mui/material';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import TypedChip, { type ChipType } from '@/shared/ui/TypedChip';

import type { TimelineEvent } from '@/shared/api/modules/activity';

/* ───────── Action → icon / color / verb ─────────────────────────────────── */

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

/**
 * MUI palette color for the leading avatar, keyed by action category.
 * Uses semantic colors to make scanning the feed faster.
 */
const ACTION_COLORS: Record<string, string> = {
  create: '#2e7d32', // success.dark
  update: '#0288d1', // info.main
  delete: '#c62828', // error.dark
  publish: '#6a1b9a', // purple
  grant: '#ed6c02', // warning.dark
  revoke: '#d84315', // deep-orange
  member: '#00897b', // teal
  tag: '#558b2f', // light-green
  job: '#455a64', // blue-grey
  batch: '#4527a0', // indigo
};

/** Human-readable verb for each action category — leads each row. */
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

/** Map the catalog resource type to the TypedChip string the design system uses. */
const RESOURCE_TYPE_TO_CHIP: Record<string, ChipType> = {
  dashboard: 'DASHBOARD',
  analysis: 'ANALYSIS',
  dataset: 'DATASET',
  datasource: 'DATASOURCE',
  folder: 'FOLDER',
  user: 'USER',
  group: 'GROUP',
};

/** Extract up to 2 initials from a user name for the avatar. */
function userInitials(user: string): string {
  const cleaned = user
    .replace(/^arn:.*:user\//, '')
    .replace(/^.*\//, '')
    .trim();
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Pretty-print the CloudTrail event name when no action category is known. */
function formatEventName(eventName: string): string {
  return eventName.replace(/([A-Z])/g, ' $1').trim();
}

/* ───────── Component ────────────────────────────────────────────────────── */

export interface TimelineRowProps {
  event: TimelineEvent;
}

export function TimelineRow({ event }: TimelineRowProps) {
  const navigate = useNavigate();

  const action = event.action ?? '';
  const Icon = ACTION_ICONS[action] ?? OtherIcon;
  const iconColor = ACTION_COLORS[action] ?? '#616161';
  const verb = ACTION_VERBS[action] ?? formatEventName(event.eventName);

  const isCatalogAsset = event.resourceType && event.resourceType !== 'other' && event.assetType;
  const chipType = isCatalogAsset ? RESOURCE_TYPE_TO_CHIP[event.resourceType!] : undefined;

  const timestamp = new Date(event.timestamp);
  const relative = formatDistanceToNow(timestamp, { addSuffix: true });
  const exactTime = format(timestamp, 'PPpp'); // e.g. "Apr 10, 2026 at 3:45:22 PM"

  const displayLabel = event.assetName || event.assetId || formatEventName(event.eventName);

  const handleAssetClick = () => {
    if (event.assetType && event.assetId) {
      navigate(`/assets/${event.assetType}s/${encodeURIComponent(event.assetId)}`);
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        py: 1.25,
        px: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Action icon */}
      <Avatar
        sx={{
          bgcolor: iconColor,
          width: 32,
          height: 32,
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 18, color: 'common.white' }} />
      </Avatar>

      {/* User + verb + asset */}
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Tooltip title={event.user}>
          <Avatar sx={{ width: 22, height: 22, fontSize: 11 }}>{userInitials(event.user)}</Avatar>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {event.user}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {verb}
        </Typography>
        {chipType ? (
          <TypedChip
            type={chipType}
            customLabel={displayLabel}
            size="small"
            onClick={handleAssetClick}
            sx={{ cursor: 'pointer' }}
          />
        ) : (
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            {displayLabel}
          </Typography>
        )}
      </Box>

      {/* Relative time (tooltip = exact) */}
      <Tooltip title={exactTime}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {relative}
        </Typography>
      </Tooltip>
    </Stack>
  );
}
