/**
 * Published SMUS assets, each with the QuickSight datasets that already
 * read it. Reusing one of those is the primary action; creating a new
 * dataset is offered only when none exists, so nothing gets duplicated.
 */
import { Search } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import type { DatasetOption } from '@/entities/definition';

import { smusApi } from '@/shared/api';
import type { SmusAsset } from '@/shared/api/modules/smus';
import { useDebounce } from '@/shared/lib/useDebounce';

import { CreateSmusDatasetForm } from './CreateSmusDatasetForm';

interface SmusAssetPickerProps {
  /** The dataset currently bound to the identifier; its audience is copied to a new dataset. */
  currentDataSetId: string;
  selected: DatasetOption | null;
  onSelect: (option: DatasetOption) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function AssetRow({
  asset,
  currentDataSetId,
  selected,
  onSelect,
}: {
  asset: SmusAsset;
  currentDataSetId: string;
  selected: DatasetOption | null;
  onSelect: (option: DatasetOption) => void;
}) {
  const [creating, setCreating] = useState(false);
  const table = asset.table ? `${asset.table.database}.${asset.table.name}` : null;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: (t) =>
          selected && asset.datasets.some((d) => d.id === selected.id)
            ? t.palette.primary.main
            : t.palette.divider,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {asset.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            {asset.projectName && (
              <Chip size="small" variant="outlined" label={asset.projectName} />
            )}
            {table && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {table}
              </Typography>
            )}
            {asset.columns && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {asset.columns.length} columns
              </Typography>
            )}
            {asset.url && (
              <Link href={asset.url} target="_blank" rel="noreferrer" variant="caption">
                Open in SMUS
              </Link>
            )}
          </Stack>
          {asset.description && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {asset.description}
            </Typography>
          )}
        </Box>
      </Stack>

      <Box sx={{ mt: 1.5 }}>
        {asset.datasets.length > 0 ? (
          <Stack spacing={0.75}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              QuickSight datasets reading this asset
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {asset.datasets.map((d) => {
                const isSelected = selected?.id === d.id;
                return (
                  <Button
                    key={d.id}
                    size="small"
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => onSelect({ id: d.id, name: d.name })}
                  >
                    {isSelected ? 'Selected: ' : 'Use '}
                    {d.name}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        ) : creating ? (
          <CreateSmusDatasetForm
            asset={asset}
            permissionsFromDataSetId={currentDataSetId}
            onCancel={() => setCreating(false)}
            onCreated={(option) => {
              setCreating(false);
              onSelect(option);
            }}
          />
        ) : (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No QuickSight dataset reads this asset yet.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCreating(true)}
              disabled={!asset.table}
            >
              Create dataset
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export function SmusAssetPicker({ currentDataSetId, selected, onSelect }: SmusAssetPickerProps) {
  const [search, setSearch] = useState('');
  // '' means every selected project. Everything in SMUS is per project
  // (listings, glossaries, environments), so this is the primary scope.
  const [projectId, setProjectId] = useState('');
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const assets = useQuery({
    queryKey: ['smus-assets', debounced],
    queryFn: () => smusApi.listAssets(debounced || undefined),
  });

  const projects = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const asset of assets.data?.assets ?? []) {
      if (!asset.projectId) continue;
      const entry = byId.get(asset.projectId) ?? {
        id: asset.projectId,
        name: asset.projectName ?? asset.projectId,
        count: 0,
      };
      entry.count += 1;
      byId.set(asset.projectId, entry);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assets.data]);

  const visible = (assets.data?.assets ?? []).filter(
    (asset) => !projectId || asset.projectId === projectId
  );

  if (assets.isLoading) {
    return (
      <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={22} />
      </Box>
    );
  }
  if (assets.error) {
    return <Alert severity="error">Could not list SMUS assets.</Alert>;
  }
  if (assets.data && !assets.data.configured) {
    return (
      <Alert severity="info">
        SMUS is not configured. Set the domain and projects in{' '}
        <Link component={RouterLink} to="/settings">
          Settings
        </Link>{' '}
        to pick from published assets.
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          select
          size="small"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">All selected projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name} ({project.count})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="Search published assets"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>
      {assets.data?.projectFilter.length ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Showing {assets.data.projectFilter.length} selected project
          {assets.data.projectFilter.length === 1 ? '' : 's'}. Change this in Settings.
        </Typography>
      ) : null}
      {visible.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No published assets match.
        </Typography>
      )}
      {visible.map((asset) => (
        <AssetRow
          key={asset.listingId}
          asset={asset}
          currentDataSetId={currentDataSetId}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </Stack>
  );
}
