/**
 * Refactored DataExportView with reduced complexity
 */
import { History as HistoryIcon } from '@mui/icons-material';
import { Alert, Box, Button, Fade, Grid, Stack, Typography, alpha, IconButton, Tooltip } from '@mui/material';
import { useState } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

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

/**
 * Initial export prompt component
 */
function InitialExportPrompt({ 
  show, 
  onStart 
}: { 
  show: boolean; 
  onStart: () => void;
}) {
  if (!show) return null;
  
  return (
    <Alert 
      severity="info" 
      action={
        <Button color="inherit" size="small" onClick={onStart}>
          Start Initial Export
        </Button>
      }
      sx={{ mb: 2 }}
    >
      <Typography variant="body2">
        No cached data found. Run an initial export to populate the cache.
      </Typography>
    </Alert>
  );
}

/**
 * Export configuration section component
 */
function ExportConfigurationSection({
  selectedAssetTypes,
  setSelectedAssetTypes,
  exportMode,
  setExportMode,
  isRunning,
  isRefreshing,
  onStartExport,
  onStopExport,
  onRefreshStatus,
  onRefreshActivity,
  onExportIngestions,
  onClearMemoryCache,
  onClearStuckJobs,
  canRefreshActivity,
  refreshingActivity,
  exportingIngestions,
  clearingCache,
  clearingStuckJobs,
}: {
  selectedAssetTypes: AssetType[];
  setSelectedAssetTypes: React.Dispatch<React.SetStateAction<AssetType[]>>;
  exportMode: ExportMode;
  setExportMode: (mode: ExportMode) => void;
  isRunning: boolean;
  isRefreshing: boolean;
  onStartExport: () => void;
  onStopExport: () => void;
  onRefreshStatus: () => void;
  onRefreshActivity: () => void;
  onExportIngestions: () => void;
  onClearMemoryCache: () => void;
  onClearStuckJobs: () => void;
  canRefreshActivity: boolean;
  refreshingActivity: boolean;
  exportingIngestions: boolean;
  clearingCache: boolean;
  clearingStuckJobs: boolean;
}) {
  return (
    <Grid container spacing={3}>
      {/* Left Column: Export Controls */}
      <Grid item xs={12} md={5}>
        <ExportControls
          exportMode={exportMode}
          onModeChange={setExportMode}
          isRunning={isRunning}
          isRefreshing={isRefreshing}
          onStartExport={onStartExport}
          onStopExport={onStopExport}
          onRefreshStatus={onRefreshStatus}
          onRefreshActivity={onRefreshActivity}
          onExportIngestions={onExportIngestions}
          onClearMemoryCache={onClearMemoryCache}
          onClearStuckJobs={onClearStuckJobs}
          canRefreshActivity={canRefreshActivity}
          refreshingActivity={refreshingActivity}
          exportingIngestions={exportingIngestions}
          clearingCache={clearingCache}
          clearingStuckJobs={clearingStuckJobs}
          selectedTypesCount={selectedAssetTypes.length}
        />
      </Grid>

      {/* Right Column: Asset Type Selection */}
      <Grid item xs={12} md={7}>
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
      </Grid>
    </Grid>
  );
}

/**
 * Export progress and activity section component
 */
function ExportProgressSection({
  showHistory,
  setShowHistory,
  currentJobId,
  exportLogs,
  isRunning,
  onSelectHistoryJob,
}: {
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  currentJobId: string | null;
  exportLogs: any[];
  isRunning: boolean;
  onSelectHistoryJob: (jobId: string) => void;
}) {
  return (
    <Box
      sx={{
        background: alpha(colors.primary.light, 0.02),
        border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
        borderRadius: `${spacing.sm / 8}px`,
        overflow: 'hidden',
      }}
    >
      {/* Header with tabs */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${alpha(colors.primary.main, 0.08)}`,
          background: alpha(colors.primary.light, 0.03),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Export Progress & Activity
        </Typography>
        
        {/* Toggle buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={!showHistory ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowHistory(false)}
            sx={{
              backgroundColor: !showHistory ? colors.primary.main : 'transparent',
              color: !showHistory ? 'white' : colors.primary.main,
              borderColor: colors.primary.main,
              '&:hover': {
                backgroundColor: !showHistory ? colors.primary.dark : alpha(colors.primary.main, 0.08),
              },
            }}
          >
            Current Export
          </Button>
          <Button
            variant={showHistory ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowHistory(true)}
            sx={{
              backgroundColor: showHistory ? colors.primary.main : 'transparent',
              color: showHistory ? 'white' : colors.primary.main,
              borderColor: colors.primary.main,
              '&:hover': {
                backgroundColor: showHistory ? colors.primary.dark : alpha(colors.primary.main, 0.08),
              },
            }}
          >
            Export History
          </Button>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 0 }}>
        {showHistory ? (
          <JobHistory
            onSelectJob={onSelectHistoryJob}
            currentJobId={currentJobId}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            {(exportLogs.length > 0 || isRunning) && (
              <ExportLogs 
                logs={exportLogs.filter(log => log.level !== 'debug').map(log => ({
                  ts: new Date(log.timestamp).getTime(),
                  msg: log.message,
                  level: log.level as 'info' | 'warn' | 'error',
                  assetType: log.details?.assetType,
                  assetId: log.details?.assetId,
                  apiCalls: log.details?.apiCalls
                }))}
                maxHeight={300}
                showTimestamps={true}
                defaultExpanded={isRunning}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function DataExportView() {
  // State for export configuration
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<AssetType[]>([
    'dashboards', 'datasets', 'analyses', 'datasources', 'groups', 'folders', 'users'
  ]);
  const [exportMode, setExportMode] = useState<ExportMode>('smart');
  const [showHistory, setShowHistory] = useState(false);
  
  // Cache summary hook
  const {
    cacheSummary,
    cacheSummaryLoading,
    showInitialExportPrompt,
    setShowInitialExportPrompt,
    loadCacheSummary,
  } = useCacheSummary();
  
  // Export job hook
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
  
  // Other operations hook
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
  
  // Handle export start
  const handleStartExport = async () => {
    await startExport(selectedAssetTypes, exportMode);
    setShowInitialExportPrompt(false);
  };

  // Handle job history selection
  const handleSelectHistoryJob = async (jobId: string) => {
    // Switch back to current export view
    setShowHistory(false);
    
    // Load the historical job details
    await loadHistoricalJob(jobId);
  };
  
  return (
    <Box>
      {/* Header matching TableHeader pattern */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: spacing.lg / 8,
          p: spacing.lg / 8,
          borderRadius: `${spacing.sm / 8}px`,
          background: `linear-gradient(135deg, ${alpha(colors.primary.light, 0.05)} 0%, ${alpha(colors.primary.main, 0.05)} 100%)`,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            Data Export
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: colors.neutral[600],
              fontWeight: 400,
            }}
          >
            Synchronize and export your QuickSight assets with advanced controls
          </Typography>
        </Box>
        <Tooltip title="View Export History">
          <IconButton
            onClick={() => setShowHistory(!showHistory)}
            sx={{
              color: showHistory ? colors.primary.main : 'text.secondary',
              '&:hover': {
                backgroundColor: alpha(colors.primary.main, 0.08),
              },
            }}
          >
            <HistoryIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack spacing={3} sx={{ px: 3, pb: 3 }}>
        
        {/* Initial Export Prompt */}
        <InitialExportPrompt 
          show={showInitialExportPrompt} 
          onStart={handleStartExport}
        />
        
        {/* Stats Grid */}
        <Fade in={!cacheSummaryLoading}>
          <Grid container spacing={2}>
            <ExportStats 
              totalAssets={cacheSummary?.totalAssets || 0}
              exportedAssets={cacheSummary?.exportedAssets || 0}
              fieldStats={cacheSummary?.fieldStatistics ? {
                total: cacheSummary.fieldStatistics.totalFields || 0,
                calculated: cacheSummary.fieldStatistics.totalCalculatedFields || 0,
                physical: (cacheSummary.fieldStatistics.totalFields || 0) - (cacheSummary.fieldStatistics.totalCalculatedFields || 0)
              } : null}
              cacheSize={cacheSummary?.totalSize}
              loading={cacheSummaryLoading}
            />
          </Grid>
        </Fade>
        
        {/* Export Configuration */}
        <ExportConfigurationSection
          selectedAssetTypes={selectedAssetTypes}
          setSelectedAssetTypes={setSelectedAssetTypes}
          exportMode={exportMode}
          setExportMode={setExportMode}
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
        />
        
        {/* Current Job Status */}
        {jobStatus && (
          <Alert 
            severity={jobStatus.status === 'failed' ? 'error' : jobStatus.status === 'completed' ? 'success' : 'info'}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              <strong>Current Job:</strong> {jobStatus.status}
              {jobStatus.message && ` - ${jobStatus.message}`}
            </Typography>
          </Alert>
        )}

        {/* Export Progress & Activity */}
        <ExportProgressSection
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          currentJobId={currentJobId}
          exportLogs={exportLogs}
          isRunning={isRunning}
          onSelectHistoryJob={handleSelectHistoryJob}
        />
      </Stack>
    </Box>
  );
}