/**
 * The form for each physical table a dataset reads: its data source
 * (chosen, never typed), and for a relational table its catalog, schema and
 * table, for custom SQL its query. S3 tables have nothing to edit here.
 */
import Editor from '@monaco-editor/react';
import { Alert, Autocomplete, Box, Chip, Stack, TextField, Typography } from '@mui/material';

import type { DatasetSourceDraft } from '../model/useDatasetSourceDraft';

const SQL_EDITOR_HEIGHT = 220;

export function DatasetSourceTables({ draft }: { draft: DatasetSourceDraft }) {
  const { tables, drafts, dataSources, setDraft, saving } = draft;
  const dataSourceOf = (arn: string) => dataSources.find((d) => d.arn === arn) ?? null;
  return (
    <Stack spacing={2}>
      {tables.map((table) => {
        const tableDraft = drafts[table.id];
        if (!tableDraft) return null;
        return (
          <Box
            key={table.id}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}
            data-testid={`source-table-${table.id}`}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
                value={dataSourceOf(tableDraft.dataSourceArn)}
                onChange={(_, value) =>
                  setDraft(table.id, { dataSourceArn: value?.arn ?? tableDraft.dataSourceArn })
                }
                disabled={!table.editable || saving}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Data source"
                    size="small"
                    // Chosen from the account's data sources only; an ARN is
                    // never typed, and the server re-checks membership.
                    helperText="Pick from this account's data sources"
                  />
                )}
              />

              {table.kind === 'RELATIONAL' && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Catalog"
                    value={tableDraft.catalog}
                    onChange={(e) => setDraft(table.id, { catalog: e.target.value })}
                    size="small"
                    fullWidth
                    disabled={saving}
                    helperText="Leave empty if the engine has no catalog"
                  />
                  <TextField
                    label="Schema / database"
                    value={tableDraft.schema}
                    onChange={(e) => setDraft(table.id, { schema: e.target.value })}
                    size="small"
                    fullWidth
                    disabled={saving}
                  />
                  <TextField
                    label="Table"
                    value={tableDraft.name}
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
                    value={tableDraft.name}
                    onChange={(e) => setDraft(table.id, { name: e.target.value })}
                    size="small"
                    fullWidth
                    disabled={saving}
                  />
                  <Box
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                  >
                    <Editor
                      height={SQL_EDITOR_HEIGHT}
                      language="sql"
                      value={tableDraft.sqlQuery}
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
  );
}
