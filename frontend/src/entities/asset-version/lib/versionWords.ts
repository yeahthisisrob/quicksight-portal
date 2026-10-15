import { format, formatDistanceToNow } from 'date-fns';

import type { AssetVersion } from '@/shared/api/modules/history';

const MOMENT_FORMAT = 'MMM d, yyyy HH:mm';

/** "Oct 15, 2026 07:15". */
export function versionMoment(at: string): string {
  return format(new Date(at), MOMENT_FORMAT);
}

/** "3 hours ago". */
export function versionAge(at: string): string {
  return formatDistanceToNow(new Date(at), { addSuffix: true });
}

/** Who made the change, as a short label, and how it was seen. */
export function versionActor(version: AssetVersion): { label: string; portal: boolean } {
  if (version.source === 'export') {
    return { label: version.by, portal: false };
  }
  return { label: version.by, portal: true };
}

/** "Rolled back" / "Written by the portal" / "Seen by Smart Sync". */
export function versionSourceWords(version: AssetVersion): string {
  if (version.source === 'rollback') return 'Rolled back';
  if (version.source === 'portal') return 'Written through the portal';
  return 'Changed outside the portal, seen by the export';
}
