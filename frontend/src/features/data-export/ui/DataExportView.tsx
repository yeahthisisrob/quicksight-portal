/**
 * DataExportView — Export Assets page
 */
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';
import { PageLayout } from '@/shared/ui';

import {
  AssetTypeSelector,
  ExportControls,
  ExportLogs,
  ExportStats,
  JobHistory,
} from './components';
import { useCacheSummary } from '../lib/useCacheSummary';
import { useExportJob } from '../lib/useExportJob';
import { useExportOperations } from '../lib/useExportOperations';

import type { AssetType, ExportMode } from '../model/types';

export default function DataExportView() {
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<AssetType[]>([
    'dashboards', 'datasets', 'analyses', 'datasources', 'groups', 'folders', 'users'
  ]);
  const [exportMode, setExportMode] = useState<ExportMode>('smart');
  const [showHistory, setShowHistory] = useState(false);

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
    exportingIngestions,
    clearingCache,
    clearingStuckJobs,
    refreshActivity,
    exportIngestions,
    clearCache,
    clearStuckJobs,
  } = useExportOperations(loadCacheSummary);

  const handleStartExport = async () => {
    await startExport(selectedAssetTypes, exportMode);
    setShowInitialExportPrompt(false);
  };

  const handleSelectHistoryJob = async (jobId: string) => {
    setShowHistory(false);
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
        {/* Stats — compact row */}
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

        {/* Export Controls + Asset Types — side by side with flexbox (no Grid negative margins) */}
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box sx={{ flex: '0 0 auto', width: { xs: '100%', md: '40%' } }}>
            <ExportControls
              exportMode={exportMode}
              onModeChange={setExportMode}
              isRunning={isRunning}
              isRefreshing={isRefreshing}
              onStartExport={handleStartExport}
              onStopExport={stopExport}
              onRefreshStatus={refreshStatus}
              onRefreshActivity={refreshActivity}
              onExportIngestions={exportIngestions}
              onClearMemoryCache={clearCache}
              onClearStuckJobs={clearStuckJobs}
              canRefreshActivity={!refreshingActivity}
              refreshingActivity={refreshingActivity}
              exportingIngestions={exportingIngestions}
              clearingCache={clearingCache}
              clearingStuckJobs={clearingStuckJobs}
              selectedTypesCount={selectedAssetTypes.length}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <AssetTypeSelector
              selectedTypes={selectedAssetTypes}
              onToggle={(assetType) => {
                setSelectedAssetTypes((prev: AssetType[]) =>
                  prev.includes(assetType)
                    ? prev.filter(t => t !== assetType)
                    : [...prev, assetType]
                );
              }}
              disabled={isRunning || exportMode === 'rebuild'}
            />
            {exportMode === 'rebuild' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Rebuild cache mode will process all asset types from existing S3 files.
              </Alert>
            )}
          </Box>
        </Box>

        {/* Current Job Status */}
        {jobStatus && (
          <Alert
            severity={jobStatus.status === 'failed' ? 'error' : jobStatus.status === 'completed' ? 'success' : 'info'}
          >
            <Typography variant="body2">
              <strong>Current Job:</strong> {jobStatus.status}
              {jobStatus.message && ` - ${jobStatus.message}`}
            </Typography>
          </Alert>
        )}

        {/* Export Progress & Activity */}
        <Box
          sx={{
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: `${spacing.sm / 8}px`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${colors.neutral[200]}`,
              bgcolor: colors.neutral[50],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Export Progress
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={!showHistory ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setShowHistory(false)}
              >
                Current
              </Button>
              <Button
                variant={showHistory ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setShowHistory(true)}
              >
                History
              </Button>
            </Box>
          </Box>

          {showHistory ? (
            <JobHistory
              onSelectJob={handleSelectHistoryJob}
              currentJobId={currentJobId}
            />
          ) : (
            <Box sx={{ p: 2 }}>
              {(exportLogs.length > 0 || isRunning) ? (
                <ExportLogs
                  logs={exportLogs.filter(log => log.level !== 'debug').map(log => ({
                    ts: new Date(log.timestamp).getTime(),
                    msg: log.message,
                    level: log.level as 'info' | 'warn' | 'error',
                    assetType: (log.details as any)?.assetType,
                    assetId: (log.details as any)?.assetId,
                    apiCalls: (log.details as any)?.apiCalls
                  }))}
                  maxHeight={300}
                  showTimestamps={true}
                  defaultExpanded={isRunning}
                />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No export activity. Start an export to see progress here.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Stack>
    </PageLayout>
  );
}
