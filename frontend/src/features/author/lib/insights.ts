/**
 * Insights → things the UI can draw: health badges for the wireframe and a
 * count of visuals worth a second look before they are cloned.
 */
import type { WireframeBadges } from '@/entities/definition';

import type { AssetInsights, VisualHealth } from '@/shared/api/modules/authoring';

/** A visual whose p90 load time is above this is flagged as slow. */
export const SLOW_VISUAL_MS = 3000;

const SECOND_MS = 1000;

export function isSlow(visual: VisualHealth): boolean {
  return (visual.loadTimeP90Ms ?? 0) > SLOW_VISUAL_MS;
}

export function hasErrors(visual: VisualHealth): boolean {
  return (visual.errors ?? 0) > 0;
}

/** "4.8s" from milliseconds. */
export function seconds(ms: number): string {
  return `${(ms / SECOND_MS).toFixed(1)}s`;
}

/** Badges keyed by visual id. Errors win over slowness when a visual has both. */
export function healthBadges(insights: AssetInsights | null | undefined): WireframeBadges {
  const badges: WireframeBadges = new Map();
  for (const visual of insights?.health?.visuals ?? []) {
    if (hasErrors(visual)) {
      const n = visual.errors ?? 0;
      badges.set(visual.visualId, {
        kind: 'error',
        label: `${n} load error${n === 1 ? '' : 's'} in the last ${insights?.health?.windowDays ?? 0} days`,
      });
    } else if (isSlow(visual)) {
      badges.set(visual.visualId, {
        kind: 'slow',
        label: `p90 load time ${seconds(visual.loadTimeP90Ms ?? 0)} (over ${seconds(SLOW_VISUAL_MS)})`,
      });
    }
  }
  return badges;
}

/** Visuals that are slow or erroring. */
export function problemVisuals(insights: AssetInsights | null | undefined): VisualHealth[] {
  return (insights?.health?.visuals ?? []).filter((v) => isSlow(v) || hasErrors(v));
}
