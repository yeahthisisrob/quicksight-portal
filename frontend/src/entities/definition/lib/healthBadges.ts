/**
 * CloudWatch health → badges on wireframe cards. Every visual with a p90
 * load time gets one: a neutral timing chip when it is fine, slow when it
 * is over the threshold, error when it failed to load. The value on the
 * card is the p90 in seconds; the label is the tooltip.
 */
import type { AssetInsights, VisualHealth } from '@/shared/api/modules/authoring';

import type { WireframeBadges } from '../model/types';

/** A visual whose p90 load time is above this is flagged as slow. */
const SLOW_VISUAL_MS = 3000;

const SECOND_MS = 1000;

export function isSlow(visual: VisualHealth): boolean {
  return (visual.loadTimeP90Ms ?? 0) > SLOW_VISUAL_MS;
}

function hasErrors(visual: VisualHealth): boolean {
  return (visual.errors ?? 0) > 0;
}

/** "4.8s" from milliseconds. */
export function seconds(ms: number): string {
  return `${(ms / SECOND_MS).toFixed(1)}s`;
}

/** Badges keyed by visual id. Errors win over slowness when a visual has both. */
export function healthBadges(insights: AssetInsights | null | undefined): WireframeBadges {
  const badges: WireframeBadges = new Map();
  const windowDays = insights?.health?.windowDays ?? 0;
  for (const visual of insights?.health?.visuals ?? []) {
    const p90 = visual.loadTimeP90Ms;
    const value = p90 !== undefined ? seconds(p90) : undefined;
    if (hasErrors(visual)) {
      const n = visual.errors ?? 0;
      badges.set(visual.visualId, {
        kind: 'error',
        value,
        label: `${n} load error${n === 1 ? '' : 's'} in the last ${windowDays} days${value ? `, p90 load time ${value}` : ''}`,
      });
    } else if (isSlow(visual)) {
      badges.set(visual.visualId, {
        kind: 'slow',
        value,
        label: `p90 load time ${seconds(p90 ?? 0)} over the last ${windowDays} days (over ${seconds(SLOW_VISUAL_MS)})`,
      });
    } else if (p90 !== undefined) {
      badges.set(visual.visualId, {
        kind: 'timing',
        value,
        label: `p90 load time ${seconds(p90)} over the last ${windowDays} days`,
      });
    }
  }
  return badges;
}

/** Visuals that are slow or erroring. */
export function problemVisuals(insights: AssetInsights | null | undefined): VisualHealth[] {
  return (insights?.health?.visuals ?? []).filter((v) => isSlow(v) || hasErrors(v));
}
