import Editor from '@monaco-editor/react';
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { assetsApi, getApiErrorMessage } from '@/shared/api';
import type {
  DataSourceOption,
  DatasetPhysicalTable,
  DatasetTableEdit,
} from '@/shared/api/modules/assets';
import { colors, typography } from '@/shared/design-system/theme';

interface DatasetSourceDialogProps {
  open: boolean;
  onClose: () => void;
  dataset: { id: string; name: string } | null;
  /** Called after a successful save so the caller can refresh its listing. */
  onSaved?: () => void;
}

/** A table's editable fields, as strings for the form. */
type TableDraft = {
  dataSourceArn: string;
  name: string;
  catalog: string;
  schema: string;
  sqlQuery: string;
};

const SQL_EDITOR_HEIGHT = 220;

const toDraft = (table: DatasetPhysicalTable): TableDraft => ({
  dataSourceArn: table.dataSourceArn,
  name: table.name,
  catalog: table.catalog ?? '',
  schema: table.schema ?? '',
  sqlQuery: table.sqlQuery ?? '',
});

/**
 * Only send what actually changed. QuickSight replaces the whole dataset
 * specification on update, so an unchanged field resent verbatim is harmless -
 * but sending nothing for it keeps the request honest about intent and lets
 * the server reject edits that do not apply to a table's kind.
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

export default function DatasetSourceDialog({
  open,
  onClose,
  dataset,
  onSaved,
}: DatasetSourceDialogProps) {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [tables, setTables] = useState<DatasetPhysicalTable[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');

  const load = useCallback(async () => {
    if (!dataset) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const source = await assetsApi.getDatasetSource(dataset.id);
      setTables(source.tables);
      setDataSources(source.dataSources);
      setDrafts(Object.fromEntries(source.tables.map((t) => [t.id, toDraft(t)])));
      setName(source.name);
      setOriginalName(source.name);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Failed to read the dataset source'));
    } finally {
      setLoading(false);
    }
  }, [dataset]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const setDraft = (id: string, patch: Partial<TableDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));
  };

  const edits = useMemo(
    () =>
      tables
        .filter((t) => t.editable && drafts[t.id])
        .map((t) => diffTable(t, drafts[t.id]!))
        .filter((e): e is DatasetTableEdit => e !== null),
    [tables, drafts]
  );

  const renamed = name.trim() !== originalName && name.trim().length > 0;
  const hasChanges = edits.length > 0 || renamed;

  const handleSave = async () => {
    if (!dataset || !hasChanges) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await assetsApi.updateDatasetSource(dataset.id, {
        ...(renamed ? { name: name.trim() } : {}),
        ...(edits.length > 0 ? { tables: edits } : {}),
      });
      enqueueSnackbar(`Updated ${name.trim()}`, { variant: 'success' });
      onSaved?.();
      onClose();
    } catch (error) {
      // QuickSight's own rejection is the useful message here - a column the
      // new table does not produce, or a query that will not parse.
      setSaveError(getApiErrorMessage(error, 'Failed to update the dataset source'));
    } finally {
      setSaving(false);
    }
  };

  const dataSourceOf = (arn: string) => dataSources.find((d) => d.arn === arn) ?? null;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: typography.fontWeight.semibold }}>
        Edit dataset source
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          {dataset?.name}
        </Typography>
      </DialogTitle>
      <Divider />

      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {loadError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>Cannot edit this dataset</AlertTitle>
            {loadError}
          </Alert>
        )}

        {!loading && !loadError && (
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Dataset name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              disabled={saving}
            />

            <Alert severity="info">
              Column definitions are kept exactly as they are. This changes only where the data
              comes from. If the new table or query does not produce those columns, QuickSight
              rejects the save and says so.
            </Alert>

            {tables.map((table) => {
              const draft = drafts[table.id];
              if (!draft) {
                return null;
              }
              return (
                <Box
                  key={table.id}
                  sx={{
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: typography.fontWeight.semibold }}
                    >
                      {table.name || table.id}
                    </Typography>
                    <Chip
                      size="small"
                      label={table.kind === 'CUSTOM_SQL' ? 'Custom SQL' : table.kind}
                      color={table.kind === 'CUSTOM_SQL' ? 'secondary' : 'default'}
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${table.columnCount} column${table.columnCount === 1 ? '' : 's'}`}
                    />
                  </Stack>

                  {!table.editable && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      This is an S3 source. It has no schema or query to edit here.
                    </Alert>
                  )}

                  <Stack spacing={2}>
                    <Autocomplete
                      options={dataSources}
                      getOptionLabel={(o) => (o.type ? `${o.name} (${o.type})` : o.name)}
                      isOptionEqualToValue={(o, v) => o.arn === v.arn}
                      value={dataSourceOf(draft.dataSourceArn)}
                      onChange={(_, value) =>
                        setDraft(table.id, { dataSourceArn: value?.arn ?? draft.dataSourceArn })
                      }
                      disabled={!table.editable || saving}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Data source"
                          size="small"
                          // Chosen from the account's data sources only; an ARN
                          // is never typed, and the server re-checks membership.
                          helperText="Pick from this account's data sources"
                        />
                      )}
                    />

                    {table.kind === 'RELATIONAL' && (
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label="Catalog"
                          value={draft.catalog}
                          onChange={(e) => setDraft(table.id, { catalog: e.target.value })}
                          size="small"
                          fullWidth
                          disabled={saving}
                          helperText="Leave empty if the engine has no catalog"
                        />
                        <TextField
                          label="Schema / database"
                          value={draft.schema}
                          onChange={(e) => setDraft(table.id, { schema: e.target.value })}
                          size="small"
                          fullWidth
                          disabled={saving}
                        />
                        <TextField
                          label="Table"
                          value={draft.name}
                          onChange={(e) => setDraft(table.id, { name: e.target.value })}
                          size="small"
                          fullWidth
                          disabled={saving}
                        />
                      </Stack>
                    )}

                    {table.kind === 'CUSTOM_SQL' && (
                      <>
                        <TextField
                          label="Query name"
                          value={draft.name}
                          onChange={(e) => setDraft(table.id, { name: e.target.value })}
                          size="small"
                          fullWidth
                          disabled={saving}
                        />
                        <Box
                          sx={{
                            border: `1px solid ${colors.neutral[200]}`,
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Editor
                            height={SQL_EDITOR_HEIGHT}
                            language="sql"
                            value={draft.sqlQuery}
                            onChange={(value) => setDraft(table.id, { sqlQuery: value ?? '' })}
                            options={{
                              readOnly: saving,
                              minimap: { enabled: false },
                              fontSize: 13,
                              scrollBeyondLastLine: false,
                              wordWrap: 'on',
                            }}
                          />
                        </Box>
                      </>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}

        {saveError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>QuickSight rejected the change</AlertTitle>
            {saveError}
          </Alert>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || saving || loading || Boolean(loadError)}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
