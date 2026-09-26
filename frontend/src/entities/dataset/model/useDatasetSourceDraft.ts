/**
 * Editing where a dataset reads from: its name and each physical table's
 * data source, catalog, schema, table or query. Loaded live from QuickSight,
 * edited as a draft, and saved as only the fields that changed (QuickSight
 * replaces the whole specification, and keeps every column as it was).
 * The source dialog and the Studio's dataset editor both edit through this.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { assetsApi, getApiErrorMessage } from '@/shared/api';
import type {
  DataSourceOption,
  DatasetPhysicalTable,
  DatasetTableEdit,
} from '@/shared/api/modules/assets';

/** A table's editable fields, as strings for the form. */
interface TableDraft {
  dataSourceArn: string;
  name: string;
  catalog: string;
  schema: string;
  sqlQuery: string;
}

const toDraft = (table: DatasetPhysicalTable): TableDraft => ({
  dataSourceArn: table.dataSourceArn,
  name: table.name,
  catalog: table.catalog ?? '',
  schema: table.schema ?? '',
  sqlQuery: table.sqlQuery ?? '',
});

/**
 * Only what changed: an unchanged field resent is harmless, but sending
 * nothing for it keeps the request honest and lets the server reject edits
 * a table's kind does not allow.
 */
function diffTable(table: DatasetPhysicalTable, draft: TableDraft): DatasetTableEdit | null {
  const edit: DatasetTableEdit = { id: table.id };
  let changed = false;
  if (draft.dataSourceArn !== table.dataSourceArn) {
    edit.dataSourceArn = draft.dataSourceArn;
    changed = true;
  }
  if (draft.name !== table.name) {
    edit.name = draft.name;
    changed = true;
  }
  if (table.kind === 'RELATIONAL') {
    if (draft.catalog !== (table.catalog ?? '')) {
      edit.catalog = draft.catalog;
      changed = true;
    }
    if (draft.schema !== (table.schema ?? '')) {
      edit.schema = draft.schema;
      changed = true;
    }
  }
  if (table.kind === 'CUSTOM_SQL' && draft.sqlQuery !== (table.sqlQuery ?? '')) {
    edit.sqlQuery = draft.sqlQuery;
    changed = true;
  }
  return changed ? edit : null;
}

export interface DatasetSourceDraft {
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  importMode: string | null;
  tables: DatasetPhysicalTable[];
  dataSources: DataSourceOption[];
  drafts: Record<string, TableDraft>;
  setDraft: (tableId: string, patch: Partial<TableDraft>) => void;
  name: string;
  setName: (name: string) => void;
  /** Each change, in words, for a summary before saving. */
  changes: string[];
  hasChanges: boolean;
  save: () => Promise<boolean>;
  reset: () => void;
}

export function useDatasetSourceDraft(
  datasetId: string | null,
  options: { enabled?: boolean; onSaved?: (name: string) => void } = {}
): DatasetSourceDraft {
  const enabled = options.enabled ?? true;
  const onSaved = options.onSaved;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tables, setTables] = useState<DatasetPhysicalTable[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [importMode, setImportMode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');

  const load = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const source = await assetsApi.getDatasetSource(datasetId);
      setTables(source.tables);
      setDataSources(source.dataSources);
      setDrafts(Object.fromEntries(source.tables.map((t) => [t.id, toDraft(t)])));
      setImportMode(source.importMode ?? null);
      setName(source.name);
      setOriginalName(source.name);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Failed to read the dataset source'));
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const edits = useMemo(
    () =>
      tables
        .filter((t) => t.editable && drafts[t.id])
        .map((t) => diffTable(t, drafts[t.id]!))
        .filter((e): e is DatasetTableEdit => e !== null),
    [tables, drafts]
  );
  const renamed = name.trim() !== originalName && name.trim().length > 0;

  const changes = useMemo(() => {
    const words: string[] = [];
    if (renamed) words.push(`Rename to "${name.trim()}"`);
    const sourceName = (arn?: string) => dataSources.find((d) => d.arn === arn)?.name ?? arn;
    for (const edit of edits) {
      const table = tables.find((t) => t.id === edit.id);
      const label = table?.name || edit.id;
      if (edit.dataSourceArn) {
        words.push(
          `${label}: ${sourceName(table?.dataSourceArn)} → ${sourceName(edit.dataSourceArn)}`
        );
      }
      if (edit.sqlQuery !== undefined) words.push(`${label}: new SQL`);
      if (
        edit.schema !== undefined ||
        edit.catalog !== undefined ||
        (edit.name && table?.kind === 'RELATIONAL')
      ) {
        words.push(
          `${label}: now reads ${[edit.catalog ?? table?.catalog, edit.schema ?? table?.schema, edit.name ?? table?.name].filter(Boolean).join('.')}`
        );
      }
    }
    return words;
  }, [edits, renamed, name, tables, dataSources]);

  const save = async (): Promise<boolean> => {
    if (!datasetId || (edits.length === 0 && !renamed)) return false;
    setSaving(true);
    setSaveError(null);
    try {
      await assetsApi.updateDatasetSource(datasetId, {
        ...(renamed ? { name: name.trim() } : {}),
        ...(edits.length > 0 ? { tables: edits } : {}),
      });
      onSaved?.(name.trim());
      await load();
      return true;
    } catch (error) {
      // QuickSight's own rejection is the useful message: a column the new
      // table does not produce, or a query that will not parse.
      setSaveError(getApiErrorMessage(error, 'Failed to update the dataset source'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    loadError,
    saving,
    saveError,
    importMode,
    tables,
    dataSources,
    drafts,
    setDraft: (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } })),
    name,
    setName,
    changes,
    hasChanges: edits.length > 0 || renamed,
    save,
    reset: () => {
      setDrafts(Object.fromEntries(tables.map((t) => [t.id, toDraft(t)])));
      setName(originalName);
      setSaveError(null);
    },
  };
}
