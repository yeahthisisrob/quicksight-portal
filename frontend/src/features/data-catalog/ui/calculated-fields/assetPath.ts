/** Where an asset lives in the portal: Author for dashboards and analyses, the list for the rest. */
export function assetPath(ref: { type: string; id: string; name: string }): string {
  if (ref.type === 'dataset' || ref.type === 'datasource') {
    return `/${ref.type}s?search=${encodeURIComponent(ref.name)}`;
  }
  return `/author?type=${ref.type}&id=${encodeURIComponent(ref.id)}&name=${encodeURIComponent(ref.name)}`;
}
