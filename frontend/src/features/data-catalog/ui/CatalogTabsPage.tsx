/**
 * The catalog, field-first. Three views under one header and one project
 * select: calculated fields (what SMUS does not have), columns tied to SMUS,
 * and the per-project SMUS assets. Tab and filters live in the URL.
 */
import {
  CloudSync,
  CollectionsBookmark,
  Functions,
  TableChart,
  ViewColumn,
} from '@mui/icons-material';
import { Alert, AlertTitle, Box, Button, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import { EmptyState, PageHeader, TabBar } from '@/shared/design-system';

import { useCatalogProjects, useCatalogUrlState } from '../lib/useCatalog';
import {
  ALL_PROJECTS,
  type CatalogTab,
  DEFAULT_CATALOG_TAB,
  pickProject,
  scopeFor,
} from '../model/catalogState';
import { CatalogPage } from './CatalogPage';
import { CalculatedFieldsView } from './calculated-fields/CalculatedFieldsView';
import { ColumnsView } from './columns/ColumnsView';
import { ProjectSelect } from './ProjectSelect';
import { TemplateLibraryDialog } from './templates/TemplateLibraryDialog';

const TABS: Array<{ value: CatalogTab; label: string; icon: React.ReactElement }> = [
  { value: 'calculated-fields', label: 'Calculated fields', icon: <Functions fontSize="small" /> },
  { value: 'columns', label: 'Columns', icon: <ViewColumn fontSize="small" /> },
  { value: 'smus', label: 'SMUS assets', icon: <TableChart fontSize="small" /> },
];

function NoExport() {
  return (
    <EmptyState
      icon={<CloudSync />}
      title="No SMUS export yet"
      description="The catalog is tied to the SMUS export, and none has run. Run one from Operations; it sweeps the selected projects' published assets once and stores them."
      action={
        <Button component={RouterLink} to="/operations?tab=smus" variant="contained">
          Open Operations
        </Button>
      }
    />
  );
}

export function CatalogTabsPage({
  initialTab,
}: {
  /** Stories only; the URL is the source of truth otherwise. */
  initialTab?: CatalogTab;
}) {
  const [url, setUrl] = useCatalogUrlState();
  const tab: CatalogTab = url.tab ?? initialTab ?? DEFAULT_CATALOG_TAB;
  const [search, setSearch] = useState(url.q ?? '');
  const [libraryOpen, setLibraryOpen] = useState(url.templates === '1');
  const [outsideCount, setOutsideCount] = useState<number | undefined>();

  const projects = useCatalogProjects();
  // Calculated fields and columns are QuickSight's own; only the SMUS tab is
  // bound to one project, so the others span every project by default.
  const spansProjects = tab !== 'smus';
  // The SMUS tab falls back to a project without writing it down, so leaving
  // that tab does not leave the field-first tabs scoped to it.
  // The picker's value is a scope as much as a project: every selected
  // project, one of them, or the datasets no listing claimed.
  const { scope, projectId } = useMemo(() => scopeFor(url.project), [url.project]);
  const smusProject = useMemo(
    () => pickProject(projects.data?.projects ?? [], url.project),
    [projects.data, url.project]
  );
  useEffect(() => {
    if ((url.q ?? '') !== search) setUrl({ q: search });
    // The URL follows the box, not the other way round, so typing stays smooth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const configured = projects.data?.configured ?? true;
  const projectOptions = projects.data?.projects ?? [];

  const openListing = (listingId: string) => setUrl({ tab: 'smus', asset: listingId });
  const openField = (key: string | undefined) =>
    setUrl({ tab: 'calculated-fields', field: key, conflicts: undefined });

  let body: React.ReactNode;
  if (projects.isError) {
    body = (
      <Alert severity="error">
        <AlertTitle>The catalog could not be loaded</AlertTitle>
        {getApiErrorMessage(projects.error, 'Unknown error')}
      </Alert>
    );
  } else if (projects.data && !configured && tab === 'smus') {
    body = (
      <EmptyState
        title="SageMaker Unified Studio is not configured"
        description="The SMUS assets tab is built from the assets published in your SMUS domain. Set the domain id, region and the projects to read from in Settings. Calculated fields and columns come from the QuickSight export and are on the other tabs either way."
        action={
          <Button component={RouterLink} to="/settings" variant="contained">
            Open Settings
          </Button>
        }
      />
    );
  } else if (projects.data && !projects.data.exportedAt && tab === 'smus') {
    body = <NoExport />;
  } else if (tab === 'smus') {
    body = <CatalogPage embedded />;
  } else if (tab === 'columns') {
    body = (
      <ColumnsView
        projectId={projectId}
        scope={scope}
        onOutsideCount={setOutsideCount}
        search={search}
        onSearch={setSearch}
        onOpenField={(key) => openField(key)}
        onOpenListing={openListing}
      />
    );
  } else {
    body = (
      <CalculatedFieldsView
        projectId={projectId}
        scope={scope}
        onOutsideCount={setOutsideCount}
        search={search}
        onSearch={setSearch}
        conflictsOnly={url.conflicts === '1'}
        onConflictsOnly={(on) => setUrl({ conflicts: on ? '1' : undefined })}
        selectedKey={url.field}
        onSelect={(key) => setUrl({ field: key })}
        onOpenListing={openListing}
      />
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <PageHeader
        title="Data catalog"
        description="What SMUS does not have: every calculated field, its lineage and its conflicts, tied back to the SMUS columns it reads."
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
                allowAll={spansProjects}
                outsideCount={outsideCount}
                value={spansProjects ? (url.project ?? ALL_PROJECTS) : smusProject?.id}
                onChange={(id) =>
                  setUrl({ project: id, asset: undefined, term: undefined, field: undefined })
                }
                disabled={projects.isLoading}
              />
            )}
          </Stack>
        }
      />
      <Box sx={{ mt: 1, mb: 2 }}>
        <TabBar<CatalogTab>
          tabs={TABS}
          value={tab}
          onChange={(next) => {
            setSearch('');
            setUrl({ tab: next, q: undefined, field: undefined, conflicts: undefined });
          }}
          ariaLabel="Catalog views"
        />
      </Box>
      {body}
      {libraryOpen && (
        <TemplateLibraryDialog
          open
          onClose={() => {
            setLibraryOpen(false);
            if (url.templates) setUrl({ templates: undefined });
          }}
        />
      )}
    </Box>
  );
}
