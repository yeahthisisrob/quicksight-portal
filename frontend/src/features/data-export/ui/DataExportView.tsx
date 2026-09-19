/**
 * DataExportView - the Export tab of Operations.
 *
 * One top-down flow: cache facts, the export container (asset types, mode,
 * run), the live job, then the activity container (this job's log, every
 * job, the activity timeline) with tabs.
 */
import { Alert, Box, Button, Divider, Stack } from '@mui/material';
import { type ReactNode, useState } from 'react';

import { Container, EmptyState, TabBar } from '@/shared/design-system';
import { PageLayout } from '@/shared/ui';

import { useCacheSummary } from '../lib/useCacheSummary';
import { useExportJob } from '../lib/useExportJob';
import { useExportOperations } from '../lib/useExportOperations';
import type { AssetType, ExportMode } from '../model/types';
import {
  AssetTypeSelector,
  ExportControls,
  ExportJobStatus,
  ExportLogs,
  ExportStats,
  JobHistory,
} from './components';
import { assetTypeConfig } from './constants';

type ExportTab = 'current' | 'history' | 'timeline';

const TIMELINE_MAX_HEIGHT = 600;
const LOG_MAX_HEIGHT = 360;

const ALL_SELECTABLE_TYPES = Object.entries(assetTypeConfig)
  .filter(([, config]) => !config.disabled)
  .map(([assetType]) => assetType as AssetType);

interface ExportTabBodyProps {
  activeTab: ExportTab;
  exportLogs: ReturnType<typeof useExportJob>['exportLogs'];
  isRunning: boolean;
  currentJobId: string | null;
  onSelectHistoryJob: (jobId: string) => void;
  /** Activity timeline content, injected by the page (cross-feature composition). */
  timelineFeed?: ReactNode;
}

function ExportTabBody({
  activeTab,
  exportLogs,
  isRunning,
  currentJobId,
  onSelectHistoryJob,
  timelineFeed,
}: ExportTabBodyProps) {
  if (activeTab === 'history') {
    return <JobHistory onSelectJob={onSelectHistoryJob} currentJobId={currentJobId} />;
  }

  if (activeTab === 'timeline') {
    return (
      <Box sx={{ maxHeight: TIMELINE_MAX_HEIGHT, display: 'flex', flexDirection: 'column' }}>
        {timelineFeed}
      </Box>
    );
  }

  if (exportLogs.length === 0 && !isRunning) {
    return (
      <EmptyState
        compact
        title="No export running"
        description="Start an export above, or open a past job from History, to see its log here."
      />
    );
  }

  return (
    <ExportLogs
      logs={exportLogs
        .filter((log) => log.level !== 'debug')
        .map((log) => ({
          ts: new Date(log.timestamp).getTime(),
          msg: log.message,
          level: log.level as 'info' | 'warn' | 'error',
          assetType: (log.details as any)?.assetType,
          assetId: (log.details as any)?.assetId,
          apiCalls: (log.details as any)?.apiCalls,
        }))}
      maxHeight={LOG_MAX_HEIGHT}
      showTimestamps
      defaultExpanded={isRunning}
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
    exportLogs,
    isRefreshing,
    startExport,
    stopExport,
    refreshStatus,
    loadHistoricalJob,
  } = useExportJob(loadCacheSummary);

  const { refreshingActivity, refreshActivity } = useExportOperations();

  const handleStartExport = async () => {
    await startExport(selectedAssetTypes, exportMode);
    setShowInitialExportPrompt(false);
  };

  const handleSelectHistoryJob = async (jobId: string) => {
    setActiveTab('current');
    await loadHistoricalJob(jobId);
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
            progress={jobStatus.progress}
            message={jobStatus.message}
            stats={jobStatus.stats}
            lastUpdatedTime={jobStatus.lastUpdatedTime}
            checkpoint={jobStatus.checkpoint}
            jobId={currentJobId}
          />
        )}

        <Container
          header="Activity"
          description="This job's log, every job the portal has run, and the account's activity timeline."
        >
          <Stack spacing={2}>
            <TabBar
              ariaLabel="Export activity"
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                { value: 'current', label: 'Current job' },
                { value: 'history', label: 'History' },
                { value: 'timeline', label: 'Timeline' },
              ]}
            />
            <ExportTabBody
              activeTab={activeTab}
              exportLogs={exportLogs}
              isRunning={isRunning}
              currentJobId={currentJobId}
              onSelectHistoryJob={handleSelectHistoryJob}
              timelineFeed={timelineFeed}
            />
          </Stack>
        </Container>
      </Stack>
    </Frame>
  );
}
