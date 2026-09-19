import { Box } from '@mui/material';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ExportPanel,
  OPERATIONS_TAB_PARAM,
  type OperationsTab,
  parseOperationsTab,
  ScriptsPanel,
} from '@/widgets/operations';

import { PageHeader, TabBar } from '@/shared/design-system';
import { navigationIcons } from '@/shared/ui/icons';

// Composes two widgets (the asset table and the restore dialog), which is
// the page layer's job under FSD, so it lives here rather than in a widget.
import { ArchivedAssetsPanel } from './ArchivedAssetsPanel';

const TABS: Array<{ value: OperationsTab; label: string; icon: keyof typeof navigationIcons }> = [
  { value: 'export', label: 'Export', icon: 'exportManagement' },
  { value: 'archived', label: 'Archived assets', icon: 'archive' },
  { value: 'scripts', label: 'Scripts', icon: 'code' },
];

/**
 * Exports, archived assets and maintenance scripts: the things an operator
 * does to the account rather than to one asset. The tab is in the URL.
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
    <Box>
      <PageHeader
        title="Operations"
        description="Exports, archived assets and maintenance scripts for the whole account."
      >
        <TabBar
          ariaLabel="Operations"
          value={tab}
          onChange={setTab}
          tabs={TABS.map(({ value, label, icon }) => {
            const Icon = navigationIcons[icon];
            return { value, label, icon: <Icon fontSize="small" /> };
          })}
        />
      </PageHeader>

      {tab === 'export' && <ExportPanel />}
      {tab === 'archived' && <ArchivedAssetsPanel />}
      {tab === 'scripts' && <ScriptsPanel />}
    </Box>
  );
}
