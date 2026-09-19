/**
 * What makes a dashboard or analysis a template.
 *
 * A QuickSight tag, so it travels with the asset, survives exports and
 * restores, and can be set from the console or any script. The Author page
 * lists templates first and offers a one-click toggle.
 */
export const TEMPLATE_TAG = { key: 'quicksight-portal:template', value: 'true' } as const;

export interface TagLike {
  key?: string;
  value?: string;
  Key?: string;
  Value?: string;
}

/** Normalises the two casings the API has used for tags. */
export function normalizeTags(tags: TagLike[] | undefined): Array<{ key: string; value: string }> {
  return (tags ?? [])
    .map((t) => ({ key: t.key ?? t.Key ?? '', value: t.value ?? t.Value ?? '' }))
    .filter((t) => t.key);
}

export function isTemplate(tags: TagLike[] | undefined): boolean {
  return normalizeTags(tags).some(
    (t) => t.key === TEMPLATE_TAG.key && t.value.toLowerCase() === TEMPLATE_TAG.value
  );
}

/** Tags worth showing on a card: everything except the template marker. */
export function displayTags(tags: TagLike[] | undefined): Array<{ key: string; value: string }> {
  return normalizeTags(tags).filter((t) => t.key !== TEMPLATE_TAG.key);
}

/** The `includeTags` query parameter the paginated list expects. */
export function templateIncludeTagsParam(): string {
  return JSON.stringify([{ key: TEMPLATE_TAG.key, value: TEMPLATE_TAG.value }]);
}
