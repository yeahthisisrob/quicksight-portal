import type { CalculatedFieldRef } from '@/shared/api/modules/data-catalog';

/** Where an asset lives in the portal: Author for dashboards and analyses, the list for datasets. */
export function assetPath(ref: CalculatedFieldRef): string {
  if (ref.type === 'dataset') {
    return `/datasets?search=${encodeURIComponent(ref.name)}`;
  }
  return `/author?type=${ref.type}&id=${encodeURIComponent(ref.id)}&name=${encodeURIComponent(ref.name)}`;
}
