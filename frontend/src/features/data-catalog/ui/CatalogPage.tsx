/**
 * The catalog, SMUS first. One project at a time (everything in SMUS is per
 * project), its published assets on the left, one asset on the right with
 * what SMUS owns and what QuickSight adds.
 */
import { CollectionsBookmark } from '@mui/icons-material';
import { Alert, AlertTitle, Box, Button, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import { EmptyState, PageHeader, pal } from '@/shared/design-system';
import { useDebounce } from '@/shared/lib/useDebounce';

import {
  type TagFilter,
  useAvailableDatasetTags,
  useCatalogAsset,
  useCatalogList,
  useCatalogProjects,
  useCatalogUrlState,
  useTaggedDatasetIds,
} from '../lib/useCatalog';
import { countCatalog, filterAssets, pickProject, termsOf } from '../model/catalogState';
import { AssetDetail } from './AssetDetail';
import { AssetList } from './AssetList';
import { CatalogStats } from './CatalogStats';
import { DatasetTagsFilter } from './DatasetTagsFilter';
import { ProjectSelect } from './ProjectSelect';
import { TemplateLibraryDialog } from './templates/TemplateLibraryDialog';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_WIDTH = 360;

function NotConfigured() {
  return (
    <EmptyState
      title="SageMaker Unified Studio is not configured"
      description="The catalog is built from the assets published in your SMUS domain. Set the domain id, region and the projects to read from in Settings."
      action={
        <Button component={RouterLink} to="/settings" variant="contained">
          Open Settings
        </Button>
      }
    />
  );
}

function NoProjects() {
  return (
    <EmptyState
      title="No projects to show"
      description="No project in the domain has published an asset yet, or the projects selected in Settings have none. An empty selection means every project."
      action={
        <Button component={RouterLink} to="/settings" variant="outlined">
          Review project selection
        </Button>
      }
    />
  );
}

export function CatalogPage() {
  const [url, setUrl] = useCatalogUrlState();
  const [search, setSearch] = useState(url.q ?? '');
  const [tags, setTags] = useState<TagFilter[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const projects = useCatalogProjects();
  const project = useMemo(
    () => pickProject(projects.data?.projects ?? [], url.project),
    [projects.data, url.project]
  );

  // Keep the URL honest once a project is chosen for the user.
  useEffect(() => {
    if (project && project.id !== url.project) setUrl({ project: project.id });
  }, [project, url.project, setUrl]);
  useEffect(() => {
    if ((url.q ?? '') !== debouncedSearch) setUrl({ q: debouncedSearch });
  }, [debouncedSearch, url.q, setUrl]);

  const list = useCatalogList({ projectId: project?.id, search: debouncedSearch });
  const availableTags = useAvailableDatasetTags();
  const tagged = useTaggedDatasetIds(tags);

  const assets = useMemo(
    () =>
      filterAssets(list.data?.assets ?? [], {
        term: url.term,
        taggedDatasetIds: tagged.data ?? null,
      }),
    [list.data, url.term, tagged.data]
  );
  const terms = useMemo(() => termsOf(list.data?.assets ?? []), [list.data]);
  const counts = useMemo(() => countCatalog(list.data?.assets ?? []), [list.data]);

  const selectedId = assets.some((a) => a.listingId === url.asset) ? url.asset : undefined;
  const detail = useCatalogAsset(selectedId);

  const configured = projects.data?.configured ?? true;
  const projectOptions = projects.data?.projects ?? [];

  let body: React.ReactNode;
  if (projects.isError) {
    body = (
      <Alert severity="error">
        <AlertTitle>The catalog could not be loaded</AlertTitle>
        {getApiErrorMessage(projects.error, 'Unknown error')}
      </Alert>
    );
  } else if (projects.data && !configured) {
    body = <NotConfigured />;
  } else if (projects.data && projectOptions.length === 0) {
    body = <NoProjects />;
  } else {
    body = (
      <Stack spacing={2}>
        <CatalogStats counts={counts} />
        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: `${LIST_WIDTH}px minmax(0, 1fr)` },
            gap: 2,
            alignItems: 'start',
            '& > :first-of-type': {
              bgcolor: pal(theme).surface.container,
              border: `1px solid ${pal(theme).line.divider}`,
              borderRadius: `${Number(theme.shape.borderRadius) * 2}px`,
              overflow: 'hidden',
              position: { md: 'sticky' },
              top: { md: 16 },
              maxHeight: { md: 'calc(100vh - 220px)' },
              display: 'flex',
              flexDirection: 'column',
            },
          })}
        >
          <AssetList
            assets={assets}
            terms={terms}
            selectedId={selectedId}
            onSelect={(asset) => setUrl({ asset })}
            search={search}
            onSearch={setSearch}
            term={url.term}
            onTerm={(term) => setUrl({ term })}
            loading={projects.isLoading || list.isLoading}
            filters={
              (availableTags.data?.length ?? 0) > 0 || tags.length > 0 ? (
                <DatasetTagsFilter
                  available={availableTags.data ?? []}
                  value={tags}
                  onChange={setTags}
                  loading={availableTags.isLoading || tagged.isLoading}
                />
              ) : undefined
            }
            emptyTitle={
              list.isError
                ? 'The assets could not be loaded'
                : url.term || tags.length || debouncedSearch
                  ? 'Nothing matches'
                  : 'This project has published nothing yet'
            }
            emptyDescription={
              list.isError
                ? getApiErrorMessage(list.error, 'Unknown error')
                : url.term || tags.length || debouncedSearch
                  ? 'Clear the search, term or tag filter to see every asset in the project.'
                  : undefined
            }
          />
          <Box sx={{ minWidth: 0 }}>
            <AssetDetail
              asset={selectedId ? detail.data : undefined}
              loading={Boolean(selectedId) && detail.isLoading}
              error={detail.isError ? getApiErrorMessage(detail.error, 'Unknown error') : null}
            />
          </Box>
        </Box>
      </Stack>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <PageHeader
        title="Catalog"
        description="Assets published in SageMaker Unified Studio, with the QuickSight datasets, calculated fields and usage the portal adds."
        counter={project ? counts.assets : undefined}
        actions={
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Button
              variant="outlined"
              startIcon={<CollectionsBookmark />}
              onClick={() => setLibraryOpen(true)}
            >
              Template library
            </Button>
            {configured && projectOptions.length > 0 && (
              <ProjectSelect
                projects={projectOptions}
                value={project?.id}
                onChange={(id) => setUrl({ project: id, asset: undefined, term: undefined })}
                disabled={projects.isLoading}
              />
            )}
          </Stack>
        }
      />
      <Box sx={{ mt: 2 }}>{body}</Box>
      {libraryOpen && <TemplateLibraryDialog open onClose={() => setLibraryOpen(false)} />}
    </Box>
  );
}
