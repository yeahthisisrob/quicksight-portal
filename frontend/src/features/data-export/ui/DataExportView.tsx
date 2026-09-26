/**
 * DataExportView - the Export tab of Operations.
 *
 * One top-down flow: cache facts, the export container (asset types, mode,
 * run), the live job, then the activity container (this job's log, followed
 * live, and the activity timeline). Every past job is on Operations > Jobs.
 */
import { Alert, Box, Button, Divider, Stack } from '@mui/material';
import { type ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { JobLogGrid, useJobLogs } from '@/entities/job';

import { Container, EmptyState, TabBar } from '@/shared/design-system';
import { PageLayout } from '@/shared/ui';

import { useCacheSummary } from '../lib/useCacheSummary';
import { useExportJob } from '../lib/useExportJob';
import { useExportOperations } from '../lib/useExportOperations';
import type { AssetType, ExportMode } from '../model/types';
import { AssetTypeSelector, ExportControls, ExportJobStatus, ExportStats } from './components';
import { assetTypeConfig } from './constants';

type ExportTab = 'current' | 'timeline';

const TIMELINE_MAX_HEIGHT = 600;
const LOG_HEIGHT = 400;

const ALL_SELECTABLE_TYPES = Object.entries(assetTypeConfig)
  .filter(([, config]) => !config.disabled)
  .map(([assetType]) => assetType as AssetType);

interface ExportTabBodyProps {
  activeTab: ExportTab;
  currentJobId: string | null;
  isRunning: boolean;
  /** Activity timeline content, injected by the page (cross-feature composition). */
  timelineFeed?: ReactNode;
}

function ExportTabBody({ activeTab, currentJobId, isRunning, timelineFeed }: ExportTabBodyProps) {
  const log = useJobLogs(currentJobId, { follow: isRunning });

  if (activeTab === 'timeline') {
    return (
      <Box sx={{ maxHeight: TIMELINE_MAX_HEIGHT, display: 'flex', flexDirection: 'column' }}>
        {timelineFeed}
      </Box>
    );
  }

  if (!currentJobId) {
    return (
      <EmptyState
        compact
        title="No export running"
        description="Start an export above to follow its log here. Past exports are under Jobs."
      />
    );
  }

  return (
    <JobLogGrid
      logs={log.logs}
      loading={log.loading}
      error={log.error}
      follow={isRunning}
      height={LOG_HEIGHT}
    />
  );
}

/** With `embedded`, the host page owns the header (the Operations page does). */
function Frame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <Box>{children}</Box>
  ) : (
    <PageLayout title="Export Assets">{children}</PageLayout>
  );
}

export default function DataExportView({
  timelineFeed,
  embedded = false,
}: {
  timelineFeed?: ReactNode;
  embedded?: boolean;
}) {
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<AssetType[]>(ALL_SELECTABLE_TYPES);
  const [exportMode, setExportMode] = useState<ExportMode>('smart');
  const [activeTab, setActiveTab] = useState<ExportTab>('current');

  const {
    cacheSummary,
    cacheSummaryLoading,
    showInitialExportPrompt,
    setShowInitialExportPrompt,
    loadCacheSummary,
  } = useCacheSummary();

  const {
    currentJobId,
    jobStatus,
    isRunning,
    isRefreshing,
    startExport,
    stopExport,
    refreshStatus,
  } = useExportJob(loadCacheSummary);

  const { refreshingActivity, refreshActivity } = useExportOperations();

  const handleStartExport = async () => {
    await startExport(selectedAssetTypes, exportMode);
    setShowInitialExportPrompt(false);
  };

  return (
    <Frame embedded={embedded}>
      <Stack spacing={2}>
        {showInitialExportPrompt && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={handleStartExport}>
                Start the first export
              </Button>
            }
          >
            Nothing is cached yet. Run an export to bring the account's assets into the portal.
          </Alert>
        )}

        <ExportStats
          totalAssets={cacheSummary?.totalAssets || 0}
          archivedAssets={cacheSummary?.archivedAssetCounts?.total || 0}
          lastUpdated={cacheSummary?.lastExportDate}
          fieldStats={
            cacheSummary?.fieldStatistics
              ? {
                  total: cacheSummary.fieldStatistics.totalFields || 0,
                  calculated: cacheSummary.fieldStatistics.totalCalculatedFields || 0,
                  physical:
                    (cacheSummary.fieldStatistics.totalFields || 0) -
                    (cacheSummary.fieldStatistics.totalCalculatedFields || 0),
                }
              : null
          }
          loading={cacheSummaryLoading}
        />

        <Container
          header="QuickSight export"
          description="Pull definitions, permissions and tags from QuickSight into the cache the rest of the portal reads."
        >
          <Stack spacing={2.5}>
            <AssetTypeSelector
              selectedTypes={selectedAssetTypes}
              onToggle={(assetType) => {
                setSelectedAssetTypes((prev: AssetType[]) =>
                  prev.includes(assetType)
                    ? prev.filter((t) => t !== assetType)
                    : [...prev, assetType]
                );
              }}
              onSelectAll={() => setSelectedAssetTypes(ALL_SELECTABLE_TYPES)}
              onClearAll={() => setSelectedAssetTypes([])}
              disabled={isRunning || exportMode === 'rebuild'}
            />
            <Divider />
            <ExportControls
              exportMode={exportMode}
              onModeChange={setExportMode}
              isRunning={isRunning}
              isRefreshing={isRefreshing}
              onStartExport={handleStartExport}
              onStopExport={stopExport}
              onRefreshStatus={refreshStatus}
              onRefreshActivity={refreshActivity}
              canRefreshActivity={!refreshingActivity}
              refreshingActivity={refreshingActivity}
              selectedTypesCount={selectedAssetTypes.length}
            />
          </Stack>
        </Container>

        {jobStatus && (
          <ExportJobStatus
            status={jobStatus.status}
            progress={jobStatus.progress ?? 0}
            message={jobStatus.message}
            stats={jobStatus.stats}
            lastUpdatedTime={jobStatus.lastUpdatedTime}
            checkpoint={jobStatus.checkpoint}
            jobId={currentJobId}
          />
        )}

        <Container
          header="Activity"
          description="This export's log, followed while it runs, and the account's activity timeline."
          actions={
            <Button size="small" component={RouterLink} to="/operations?tab=jobs&type=export">
              All export jobs
            </Button>
          }
        >
          <Stack spacing={2}>
            <TabBar
              ariaLabel="Export activity"
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                { value: 'current', label: 'This export' },
                { value: 'timeline', label: 'Timeline' },
              ]}
            />
            <ExportTabBody
              activeTab={activeTab}
              currentJobId={currentJobId}
              isRunning={isRunning}
              timelineFeed={timelineFeed}
            />
          </Stack>
        </Container>
      </Stack>
    </Frame>
  );
}
