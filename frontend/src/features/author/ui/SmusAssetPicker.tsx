/**
 * Published SMUS assets, each with the QuickSight datasets that already
 * read it. Reusing one of those is the primary action; creating a new
 * dataset is offered only when none exists, so nothing gets duplicated.
 */
import { CloudSync, Search } from '@mui/icons-material';
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
import { EmptyState } from '@/shared/design-system';
import { SEARCH_MIN_LENGTH, useSearchHits } from '@/shared/lib/search';

import { CreateSmusDatasetForm } from './CreateSmusDatasetForm';

interface SmusAssetPickerProps {
  /** The dataset currently bound to the identifier; its audience is copied to a new dataset. */
  currentDataSetId: string;
  selected: DatasetOption | null;
  onSelect: (option: DatasetOption) => void;
  /** A dataset made here, just now, is chosen through this instead when given. */
  onCreated?: (option: DatasetOption) => void;
}

function AssetRow({
  asset,
  currentDataSetId,
  selected,
  onSelect,
  onCreated,
}: {
  asset: SmusAsset;
  currentDataSetId: string;
  selected: DatasetOption | null;
  onSelect: (option: DatasetOption) => void;
  onCreated?: (option: DatasetOption) => void;
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
              (onCreated ?? onSelect)(option);
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

export function SmusAssetPicker({
  currentDataSetId,
  selected,
  onSelect,
  onCreated,
}: SmusAssetPickerProps) {
  const [search, setSearch] = useState('');
  // '' means every selected project. Everything in SMUS is per project
  // (listings, glossaries, environments), so this is the primary scope.
  const [projectId, setProjectId] = useState('');
  // The listings come once; typing ranks them through /search (name, table,
  // columns, glossary terms, project) and the rows are the same rows.
  const searching = search.trim().length >= SEARCH_MIN_LENGTH;
  const found = useSearchHits(search, { types: ['smus-listing'], enabled: searching });
  const assets = useQuery({
    queryKey: ['smus-assets'],
    queryFn: () => smusApi.listAssets(),
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

  const inProject = (assets.data?.assets ?? []).filter(
    (asset) => !projectId || asset.projectId === projectId
  );
  // Hits map back onto the listings by id, in the server's rank order; a
  // listing the search did not return is not shown while a search is on.
  const visible = useMemo(() => {
    if (!searching) {
      return inProject;
    }
    const byId = new Map(inProject.map((asset) => [asset.listingId, asset]));
    return found.hits
      .map((hit) => byId.get(hit.id))
      .filter((asset): asset is SmusAsset => asset !== undefined);
  }, [searching, inProject, found.hits]);

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
  if (assets.data && !assets.data.exportedAt) {
    return (
      <EmptyState
        compact
        icon={<CloudSync />}
        title="No SMUS export yet"
        description="Published assets come from the SMUS export, and none has run. Run one from Operations, then pick a target here."
        action={
          <Button component={RouterLink} to="/operations?tab=smus" variant="contained">
            Open Operations
          </Button>
        }
      />
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
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
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
      {searching && found.loading && visible.length === 0 ? (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={20} />
        </Box>
      ) : visible.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {searching
            ? `Nothing matches "${found.query}". Names, tables, columns, glossary terms and projects all count.`
            : 'No published assets match.'}
        </Typography>
      ) : null}
      {visible.map((asset) => (
        <AssetRow
          key={asset.listingId}
          asset={asset}
          currentDataSetId={currentDataSetId}
          selected={selected}
          onSelect={onSelect}
          onCreated={onCreated}
        />
      ))}
    </Stack>
  );
}
