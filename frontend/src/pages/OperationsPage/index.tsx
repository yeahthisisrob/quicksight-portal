import { Box } from '@mui/material';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ActivityPanel } from '@/features/activity';
import { JobsView } from '@/features/jobs';
import { SmusExportPanel } from '@/features/smus';
import {
  ExportPanel,
  OPERATIONS_TAB_PARAM,
  type OperationsTab,
  parseOperationsTab,
} from '@/widgets/operations';

import { PageHeader, SectionNav } from '@/shared/design-system';

// Composes two widgets (the asset table and the restore dialog), which is
// the page layer's job under FSD, so it lives here rather than in a widget.
import { ArchivedAssetsPanel } from './ArchivedAssetsPanel';

const SECTIONS: Array<{ id: OperationsTab; label: string }> = [
  { id: 'export', label: 'Export' },
  { id: 'activity', label: 'Activity refresh' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'smus', label: 'SageMaker Unified Studio' },
  { id: 'archived', label: 'Archived assets' },
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
    <Box sx={{ minWidth: 0 }}>
      <PageHeader
        title="Operations"
        description="The QuickSight export, the activity refresh, every job the portal runs, the SageMaker Unified Studio snapshot and archived assets for the whole account."
      />
      <SectionNav ariaLabel="Operations sections" value={tab} onChange={setTab} sections={SECTIONS}>
        {tab === 'export' && <ExportPanel />}
        {tab === 'activity' && <ActivityPanel />}
        {tab === 'jobs' && <JobsView />}
        {tab === 'smus' && <SmusExportPanel />}
        {tab === 'archived' && <ArchivedAssetsPanel />}
      </SectionNav>
    </Box>
  );
}
