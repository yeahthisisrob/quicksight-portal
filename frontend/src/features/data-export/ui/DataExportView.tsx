/**
 * DataExportView — Export Assets page.
 *
 * Layout is a single top-down flow: cache stats, one Export card
 * (mode → asset types → run), a live job-status panel, and a tabbed
 * activity card (current job logs / job history / activity timeline).
 */
import { Alert, Box, Button, Card, Divider, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';

import { spacing } from '@/shared/design-system/theme';
import { PageLayout } from '@/shared/ui';

import {
  AssetTypeSelector,
  ExportControls,
  ExportJobStatus,
  ExportLogs,
  ExportStats,
  JobHistory,
} from './components';
import { assetTypeConfig } from './constants';
import { useCacheSummary } from '../lib/useCacheSummary';
import { useExportJob } from '../lib/useExportJob';
import { useExportOperations } from '../lib/useExportOperations';

import type { AssetType, ExportMode } from '../model/types';

type ExportTab = 'current' | 'history' | 'timeline';

const ALL_SELECTABLE_TYPES = Object.entries(assetTypeConfig)
  .filter(([, config]) => !(config as any).disabled)
  .map(([assetType]) => assetType as AssetType);

/**
 * Renders the content for the active tab of the activity card. Extracted from
 * DataExportView so the parent stays under the cyclomatic-complexity limit.
 */
interface ExportTabBodyProps {
  activeTab: ExportTab;
  exportLogs: ReturnType<typeof useExportJob>['exportLogs'];
  isRunning: boolean;
  currentJobId: string | null;
  onSelectHistoryJob: (jobId: string) => void;
  /** Activity timeline content, injected by the page (cross-feature composition) */
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
      <Box sx={{ maxHeight: 600, display: 'flex', flexDirection: 'column' }}>
        {timelineFeed}
      </Box>
    );
  }

  // activeTab === 'current'
  if (exportLogs.length === 0 && !isRunning) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No export activity. Start an export to see progress here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <ExportLogs
        logs={exportLogs.filter(log => log.level !== 'debug').map(log => ({
          ts: new Date(log.timestamp).getTime(),
          msg: log.message,
          level: log.level as 'info' | 'warn' | 'error',
          assetType: (log.details as any)?.assetType,
          assetId: (log.details as any)?.assetId,
          apiCalls: (log.details as any)?.apiCalls,
        }))}
        maxHeight={300}
        showTimestamps={true}
        defaultExpanded={isRunning}
      />
    </Box>
  );
}

export default function DataExportView({ timelineFeed }: { timelineFeed?: ReactNode }) {
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

  const {
    refreshingActivity,
    refreshActivity,
  } = useExportOperations();

  const handleStartExport = async () => {
    await startExport(selectedAssetTypes, exportMode);
    setShowInitialExportPrompt(false);
  };

  const handleSelectHistoryJob = async (jobId: string) => {
    setActiveTab('current');
    await loadHistoricalJob(jobId);
  };

  return (
    <PageLayout title="Export Assets">

      {/* Initial Export Prompt */}
      {showInitialExportPrompt && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={handleStartExport}>
              Start Initial Export
            </Button>
          }
          sx={{ mb: 2 }}
        >
          No cached data found. Run an initial export to populate the cache.
        </Alert>
      )}

      <Stack spacing={2}>
        {/* Cache stats — compact row */}
        <ExportStats
          totalAssets={cacheSummary?.totalAssets || 0}
          archivedAssets={cacheSummary?.archivedAssetCounts?.total || 0}
          lastUpdated={cacheSummary?.lastExportDate}
          fieldStats={cacheSummary?.fieldStatistics ? {
            total: cacheSummary.fieldStatistics.totalFields || 0,
            calculated: cacheSummary.fieldStatistics.totalCalculatedFields || 0,
            physical: (cacheSummary.fieldStatistics.totalFields || 0) - (cacheSummary.fieldStatistics.totalCalculatedFields || 0)
          } : null}
          loading={cacheSummaryLoading}
        />

        {/* Export configuration: mode → asset types → run */}
        <Card>
          <Box sx={{ p: spacing.md / 8 + 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: spacing.md / 8 }}>
              Export
            </Typography>
            <Stack spacing={spacing.md / 8}>
              <AssetTypeSelector
                selectedTypes={selectedAssetTypes}
                onToggle={(assetType) => {
                  setSelectedAssetTypes((prev: AssetType[]) =>
                    prev.includes(assetType)
                      ? prev.filter(t => t !== assetType)
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
          </Box>
        </Card>

        {/* Current job status: progress bar, stats, per-type checkpoint
            progress, and worker heartbeat liveness */}
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

        {/* Export activity: current logs / history / timeline */}
        <Card sx={{ overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(_, tab) => setActiveTab(tab)}
            sx={{ px: 1, borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
          >
            <Tab label="Current Job" value="current" sx={{ minHeight: 44, textTransform: 'none' }} />
            <Tab label="History" value="history" sx={{ minHeight: 44, textTransform: 'none' }} />
            <Tab label="Timeline" value="timeline" sx={{ minHeight: 44, textTransform: 'none' }} />
          </Tabs>

          <ExportTabBody
            activeTab={activeTab}
            exportLogs={exportLogs}
            isRunning={isRunning}
            currentJobId={currentJobId}
            onSelectHistoryJob={handleSelectHistoryJob}
            timelineFeed={timelineFeed}
          />
        </Card>
      </Stack>
    </PageLayout>
  );
}
