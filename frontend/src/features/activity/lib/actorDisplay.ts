/**
 * How an event's actor and origin read on screen. The backend already
 * names the portal's own role "Portal" and shortens SSO sessions; this
 * turns actor, origin and provenance into a label, a secondary line, an
 * icon kind and tooltip lines, so no row ever shows an assumed-role string.
 */
import type { TimelineEvent } from '@/shared/api/modules/activity';

export type ActorIconKind = 'portal' | 'agent' | 'user' | 'role' | 'root' | 'service' | 'unknown';

export interface ActorDisplay {
  /** "Portal", "rob@example.com", "Admin / rob". */
  label: string;
  /** For portal events with provenance: who was behind it. */
  via?: string;
  icon: ActorIconKind;
  /** Lines for the tooltip: the raw actor, the provenance action, the job. */
  tooltip: string[];
}

export type TimelineOrigin = TimelineEvent['origin'];

export interface OriginMeta {
  label: string;
  /** Which tone paints the badge. */
  tone: 'brand' | 'info' | 'success' | 'warning' | 'neutral';
  description: string;
}

export const ORIGIN_META: Record<TimelineOrigin, OriginMeta> = {
  'portal-ui': {
    label: 'Portal',
    tone: 'brand',
    description: 'A person, through this portal',
  },
  'portal-api': {
    label: 'Agent',
    tone: 'success',
    description: 'An API key, such as an agent, through this portal',
  },
  portal: {
    label: 'Portal',
    tone: 'brand',
    description: 'This portal, with no matching audit record',
  },
  console: {
    label: 'Console',
    tone: 'neutral',
    description: 'Directly in QuickSight or through AWS credentials',
  },
  automation: {
    label: 'Automation',
    tone: 'info',
    description: 'An AWS service',
  },
  unknown: {
    label: 'Unknown',
    tone: 'neutral',
    description: 'The actor could not be read from the event',
  },
};

/** Origins in the order a filter lists them. */
export const ORIGIN_OPTIONS: Array<{ value: TimelineOrigin; label: string }> = [
  { value: 'portal-ui', label: 'Portal (a person)' },
  { value: 'portal-api', label: 'Agent (API key)' },
  { value: 'portal', label: 'Portal (unattributed)' },
  { value: 'console', label: 'Console' },
  { value: 'automation', label: 'Automation' },
];

/** The one-click filter for "what did agents change". */
export const AGENT_ORIGINS: TimelineOrigin[] = ['portal-api'];

export function actorDisplay(event: TimelineEvent): ActorDisplay {
  const { actor, provenance } = event;
  if (actor.kind === 'portal') {
    const tooltip = [`Portal role: ${actor.raw}`];
    if (provenance) {
      tooltip.push(`Action: ${provenance.action}`);
      if (provenance.jobId) {
        tooltip.push(`Job: ${provenance.jobId}`);
      }
      const isAgent = provenance.actor.kind === 'api-key';
      return {
        label: 'Portal',
        via: isAgent ? `API key ${provenance.actor.label}` : provenance.actor.label,
        icon: isAgent ? 'agent' : 'portal',
        tooltip,
      };
    }
    return { label: 'Portal', icon: 'portal', tooltip };
  }
  const tooltip = actor.raw && actor.raw !== actor.label ? [actor.raw] : [];
  switch (actor.kind) {
    case 'role':
      return { label: actor.label, icon: 'role', tooltip };
    case 'root':
      return { label: actor.label, icon: 'root', tooltip };
    case 'service':
      return { label: actor.label, icon: 'service', tooltip };
    case 'user':
      return { label: actor.label, icon: 'user', tooltip };
    default:
      return { label: actor.label || 'Unknown', icon: 'unknown', tooltip };
  }
}

/** A stable key for "the same actor", used to collapse bursts. */
export function actorKey(event: TimelineEvent): string {
  if (event.provenance) {
    return `${event.provenance.actor.kind}:${event.provenance.actor.id}`;
  }
  return `${event.actor.kind}:${event.actor.raw || event.user}`;
}
