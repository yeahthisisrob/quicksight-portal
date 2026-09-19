/**
 * Create a QuickSight dataset over a published SMUS asset, inline.
 * The data source is picked from the account (Athena first), never typed;
 * permissions are copied from the dataset being replaced so the new one is
 * visible to the same people.
 */
import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { DatasetOption } from '@/entities/definition';

import { assetsApi, getApiErrorMessage, smusApi } from '@/shared/api';
import type { CreateSmusDatasetRequest, SmusAsset } from '@/shared/api/modules/smus';

interface CreateSmusDatasetFormProps {
  asset: SmusAsset;
  permissionsFromDataSetId: string;
  onCreated: (option: DatasetOption) => void;
  onCancel: () => void;
}

interface DataSourceItem {
  id: string;
  name: string;
  type?: string;
}

const PAGE_SIZE = 100;

/** Athena is what reads a Lakehouse / Glue table; put it first. */
function rankDataSources(items: DataSourceItem[]): DataSourceItem[] {
  return [...items].sort((a, b) => {
    const athenaA = a.type === 'ATHENA' ? 0 : 1;
    const athenaB = b.type === 'ATHENA' ? 0 : 1;
    return athenaA - athenaB || a.name.localeCompare(b.name);
  });
}

export function CreateSmusDatasetForm({
  asset,
  permissionsFromDataSetId,
  onCreated,
  onCancel,
}: CreateSmusDatasetFormProps) {
  const [dataSource, setDataSource] = useState<DataSourceItem | null>(null);
  const [importMode, setImportMode] =
    useState<CreateSmusDatasetRequest['importMode']>('DIRECT_QUERY');
  const [name, setName] = useState(asset.name);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataSources = useQuery({
    queryKey: ['author-datasources'],
    queryFn: async () => {
      const result = await assetsApi.getDatasourcesPaginated({ pageSize: PAGE_SIZE, page: 1 });
      return rankDataSources(
        result.datasources.map((d) => ({ id: d.id, name: d.name, type: d.type }))
      );
    },
  });

  const create = async () => {
    if (!dataSource) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await smusApi.createDataset(asset.listingId, {
        dataSourceId: dataSource.id,
        importMode,
        name: name.trim() || undefined,
        permissionsFromDataSetId,
      });
      onCreated({ id: created.dataSetId, name: created.name });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create the dataset'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        New dataset over{' '}
        <code>
          {asset.table?.database}.{asset.table?.name}
        </code>
        {asset.columns ? ` with its ${asset.columns.length} columns` : ''}. Its permissions are
        copied from the dataset being replaced.
      </Typography>
      <Autocomplete
        options={dataSources.data ?? []}
        loading={dataSources.isLoading}
        value={dataSource}
        onChange={(_, next) => setDataSource(next)}
        getOptionLabel={(o) => (o.type ? `${o.name} (${o.type})` : o.name)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        size="small"
        renderInput={(params) => (
          <TextField {...params} label="Data source" helperText="Athena sources are listed first" />
        )}
      />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={importMode}
          onChange={(_, next: CreateSmusDatasetRequest['importMode'] | null) =>
            next && setImportMode(next)
          }
        >
          <ToggleButton value="DIRECT_QUERY">Direct query</ToggleButton>
          <ToggleButton value="SPICE">SPICE</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          label="Dataset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ flex: 1 }}
        />
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} disabled={creating}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={create}
          disabled={!dataSource || creating}
          startIcon={creating ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Create and use
        </Button>
      </Stack>
    </Stack>
  );
}
