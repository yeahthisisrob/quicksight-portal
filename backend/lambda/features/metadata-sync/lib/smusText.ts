/**
 * A SageMaker Unified Studio asset's text, read and written. The asset's own
 * name and description are the table's; each column's business name and
 * description are one entry in the asset's column business metadata form.
 *
 * A revision must carry every form the asset has, so each is sent back as it
 * was read and only the column form is replaced. Entries for columns the
 * sync does not touch are kept.
 */
import type { CatalogAsset, CatalogAssetRevision } from '../../../adapters/aws/DataZoneAdapter';
import { type FieldWrite, type Shown, TABLE_KEY } from '../types';

export const COLUMN_FORM = 'ColumnBusinessMetadataForm';
export const COLUMN_FORM_TYPE = 'amazon.datazone.ColumnBusinessMetadataFormType';

interface ColumnEntry {
  columnIdentifier: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

function columnEntries(content: string | undefined): ColumnEntry[] {
  if (!content) {
    return [];
  }
  try {
    const parsed = JSON.parse(content) as { columnsBusinessMetadata?: ColumnEntry[] };
    return (parsed.columnsBusinessMetadata ?? []).filter((e) => e?.columnIdentifier);
  } catch {
    return [];
  }
}

/** What the asset shows. Its name counts as a business name only once it is not the table's own. */
export function smusShown(asset: CatalogAsset, table: string): Shown {
  const shown: Shown = {};
  const form = asset.forms.find((f) => f.formName === COLUMN_FORM);
  for (const entry of columnEntries(form?.content)) {
    shown[entry.columnIdentifier] = {
      ...(entry.description ? { description: entry.description } : {}),
      ...(entry.name ? { businessName: entry.name } : {}),
    };
  }
  shown[TABLE_KEY] = {
    ...(asset.description ? { description: asset.description } : {}),
    ...(asset.name && asset.name !== table ? { businessName: asset.name } : {}),
  };
  return shown;
}

/** The asset as a new revision with the text written in. */
export function smusRevision(
  asset: CatalogAsset,
  writes: readonly FieldWrite[]
): CatalogAssetRevision {
  const current = asset.forms.find((f) => f.formName === COLUMN_FORM);
  const entries = new Map(columnEntries(current?.content).map((e) => [e.columnIdentifier, e]));
  let name = asset.name;
  let description = asset.description;
  for (const write of writes) {
    if (write.key === TABLE_KEY) {
      if (write.field === 'description') description = write.value;
      else name = write.value;
      continue;
    }
    const entry: ColumnEntry = { ...entries.get(write.key), columnIdentifier: write.key };
    if (write.field === 'description') entry.description = write.value;
    else entry.name = write.value;
    entries.set(write.key, entry);
  }
  const forms: CatalogAssetRevision['forms'] = asset.forms
    .filter((f) => f.formName !== COLUMN_FORM)
    .map((f) => ({
      formName: f.formName,
      typeIdentifier: f.typeName,
      typeRevision: f.typeRevision,
      content: f.content,
    }));
  if (entries.size > 0) {
    forms.push({
      formName: COLUMN_FORM,
      typeIdentifier: COLUMN_FORM_TYPE,
      typeRevision: current?.typeRevision,
      content: JSON.stringify({ columnsBusinessMetadata: [...entries.values()] }),
    });
  }
  return {
    name,
    ...(description ? { description } : {}),
    ...(asset.glossaryTerms.length > 0 ? { glossaryTerms: asset.glossaryTerms } : {}),
    forms,
  };
}
