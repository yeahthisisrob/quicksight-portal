/**
 * DataExportView - the Export tab of Operations.
 *
 * One top-down flow: cache facts, the export container (asset types, mode,
 * run), the live job, then this export's log, followed live. Every past job
 * is on Operations > Jobs; the account's activity has its own page.
 */
import { Alert, Box, Button, Divider, Stack } from '@mui/material';
import { type ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { JobLogGrid, useJobLogs } from '@/entities/job';

import { Container, EmptyState } from '@/shared/design-system';
import { PageLayout } from '@/shared/ui';

import { useCacheSummary } from '../lib/useCacheSummary';
import { useExportJob } from '../lib/useExportJob';
import { useExportOperations } from '../lib/useExportOperations';
import type { AssetType, ExportMode } from '../model/types';
import { AssetTypeSelector, ExportControls, ExportJobStatus, ExportStats } from './components';
import { assetTypeConfig } from './constants';

const LOG_HEIGHT = 400;

const ALL_SELECTABLE_TYPES = Object.entries(assetTypeConfig)
  .filter(([, config]) => !config.disabled)
  .map(([assetType]) => assetType as AssetType);

function ExportLog({
  currentJobId,
  isRunning,
}: {
  currentJobId: string | null;
  isRunning: boolean;
}) {
  const log = useJobLogs(currentJobId, { follow: isRunning });

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

export default function DataExportView({ embedded = false }: { embedded?: boolean }) {
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<AssetType[]>(ALL_SELECTABLE_TYPES);
  const [exportMode, setExportMode] = useState<ExportMode>('smart');

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
          header="Log"
          description="This export's log, followed while it runs."
          actions={
            <Button size="small" component={RouterLink} to="/operations?tab=jobs&type=export">
              All export jobs
            </Button>
          }
        >
          <ExportLog currentJobId={currentJobId} isRunning={isRunning} />
        </Container>
      </Stack>
    </Frame>
  );
}
