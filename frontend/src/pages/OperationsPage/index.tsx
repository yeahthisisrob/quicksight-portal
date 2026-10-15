import { Box } from '@mui/material';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { JobsView } from '@/features/jobs';
import { SmusExportPanel } from '@/features/smus';
import {
  ExportPanel,
  OPERATIONS_TAB_PARAM,
  type OperationsTab,
  parseOperationsTab,
} from '@/widgets/operations';

import { PageHeader, SectionNav } from '@/shared/design-system';
import { navigationIcons } from '@/shared/ui/icons';

// Composes two widgets (the asset table and the restore dialog), which is
// the page layer's job under FSD, so it lives here rather than in a widget.
import { ArchivedAssetsPanel } from './ArchivedAssetsPanel';

const SECTIONS: Array<{ value: OperationsTab; label: string; icon: keyof typeof navigationIcons }> =
  [
    { value: 'export', label: 'Export', icon: 'exportManagement' },
    { value: 'jobs', label: 'Jobs', icon: 'jobs' },
    { value: 'smus', label: 'SageMaker Unified Studio', icon: 'dataCatalog' },
    { value: 'archived', label: 'Archived assets', icon: 'archive' },
  ];

/**
 * Exports, every job the portal runs, the SMUS export and archived assets:
 * the things an operator does to the account rather than to one asset. One
 * section at a time, listed on the left like Settings; the open one is in
 * the URL.
 */
export default function OperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseOperationsTab(searchParams.get(OPERATIONS_TAB_PARAM));

  const setTab = useCallback(
    (next: OperationsTab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'export') {
            params.delete(OPERATIONS_TAB_PARAM);
          } else {
            params.set(OPERATIONS_TAB_PARAM, next);
          }
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <PageHeader
        title="Operations"
        description="Exports, every job the portal runs, the SageMaker Unified Studio snapshot and archived assets for the whole account."
      />
      <SectionNav
        ariaLabel="Operations sections"
        value={tab}
        onChange={setTab}
        sections={SECTIONS.map(({ value, label, icon }) => {
          const Icon = navigationIcons[icon];
          return { id: value, label, icon: <Icon fontSize="small" /> };
        })}
      >
        {tab === 'export' && <ExportPanel />}
        {tab === 'jobs' && <JobsView />}
        {tab === 'smus' && <SmusExportPanel />}
        {tab === 'archived' && <ArchivedAssetsPanel />}
      </SectionNav>
    </Box>
  );
}
