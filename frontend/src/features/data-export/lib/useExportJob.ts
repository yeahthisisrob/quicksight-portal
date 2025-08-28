/**
 * Hook for managing export job state and operations
 */
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';

import { exportApi } from '@/shared/api';

import type { AssetType, ExportMode } from '../model/types';
import type {
  ExportJobOptions,
  ExportLogEntry,
  JobStatus as JobStatusType,
  RefreshOptions,
} from '@/shared/api/types/export.types';


interface JobStatus {
  status: JobStatusType;
  progress: number;
  message?: string;
  stats?: {
    totalAssets?: number;
    processedAssets?: number;
    failedAssets?: number;
    apiCalls?: number;
  };
}

/**
 * Convert plural UI asset types to singular backend asset types
 */
function convertAssetTypes(selectedTypes: AssetType[]): string[] {
  const mapping: Record<AssetType, string> = {
    dashboards: 'dashboard',
    datasets: 'dataset',
    analyses: 'analysis',
    datasources: 'datasource',
    folders: 'folder',
    groups: 'group',
    users: 'user',
    themes: 'theme',
  };
  
  return selectedTypes.map(type => mapping[type]).filter(Boolean);
}

/**
 * Build export options based on export mode
 */
function buildExportOptions(
  exportMode: ExportMode,
  backendAssetTypes: string[]
): ExportJobOptions {
  const baseOptions: ExportJobOptions = {
    forceRefresh: exportMode === 'force',
    rebuildIndex: exportMode === 'rebuild',
    assetTypes: exportMode === 'rebuild' ? undefined : backendAssetTypes,
  };

  // Build refresh options based on mode
  const refreshOptions = buildRefreshOptions(exportMode);
  if (refreshOptions) {
    baseOptions.refreshOptions = refreshOptions;
  }

  return baseOptions;
}

/**
 * Build refresh options for specific export modes
 */
function buildRefreshOptions(exportMode: ExportMode): RefreshOptions | undefined {
  switch (exportMode) {
    case 'permissions':
      return {
        definitions: false,
        permissions: true,
        tags: false,
      };
    case 'tags':
      return {
        definitions: false,
        permissions: false,
        tags: true,
      };
    case 'smart':
      // Smart mode refreshes everything that's changed
      return {
        definitions: true,
        permissions: true,
        tags: true,
      };
    default:
      return undefined;
  }
}

/**
 * Check if error is a network error with status code
 */
function isNetworkError(error: unknown): error is { response?: { status?: number } } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'response' in error &&
    typeof (error as any).response === 'object'
  );
}

/**
 * Get error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export function useExportJob(onCacheSummaryUpdate: () => void) {
  const { enqueueSnackbar } = useSnackbar();
  
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [exportLogs, setExportLogs] = useState<ExportLogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isViewingHistorical, setIsViewingHistorical] = useState(false);
  const [jobStartedInSession, setJobStartedInSession] = useState(false);
  
  // Load job status and logs
  const loadJobStatus = useCallback(async (jobId?: string) => {
    const targetJobId = jobId || currentJobId;
    if (!targetJobId) return;
    
    try {
      const status = await exportApi.getJobStatus(targetJobId);
      if (!status) return;
      
      setJobStatus({
        status: status.status,
        progress: status.progress || 0,
        message: status.message,
        stats: status.stats
      });
      
      // Load logs for all jobs (running or completed)
      try {
        const logsData = await exportApi.getJobLogs(targetJobId);
        if (logsData?.logs) {
          setExportLogs(logsData.logs);
        }
      } catch {
        // Silently fail - logs might not be available yet
      }
      
      // Update running state based on job status
      const isComplete = ['completed', 'failed', 'stopped'].includes(status.status);
      if (isComplete) {
        setIsRunning(false);
        
        // Only show completion toasts for jobs started in this session
        if (jobStartedInSession) {
          if (status.status === 'completed') {
            enqueueSnackbar('Export completed successfully!', { variant: 'success' });
            onCacheSummaryUpdate();
          } else if (status.status === 'failed') {
            enqueueSnackbar('Export failed. Check logs for details.', { variant: 'error' });
          }
        } else {
          // Still update cache summary for completed jobs, just no toast
          if (status.status === 'completed') {
            onCacheSummaryUpdate();
          }
        }
      }
    } catch (error) {
      // Handle job not found
      if (isNetworkError(error) && error.response?.status && [400, 404].includes(error.response.status)) {
        const storedJobId = localStorage.getItem('lastExportJobId');
        if (storedJobId === targetJobId) {
          localStorage.removeItem('lastExportJobId');
        }
        setCurrentJobId(null);
        setJobStatus(null);
      }
    }
  }, [currentJobId, enqueueSnackbar, onCacheSummaryUpdate, jobStartedInSession]);
  
  // Start export job
  const startExport = useCallback(async (
    selectedAssetTypes: AssetType[],
    exportMode: ExportMode
  ) => {
    if (isRunning) return;
    
    try {
      setIsRunning(true);
      setExportLogs([]);
      setJobStatus(null);
      setCurrentJobId(null);
      setIsViewingHistorical(false);
      setJobStartedInSession(true);
      
      enqueueSnackbar('Starting export job...', { variant: 'info' });
      
      // Warm up Lambda if cold
      await exportApi.warmUp();
      
      // Convert asset types
      const backendAssetTypes = convertAssetTypes(selectedAssetTypes);
      
      // Build export options based on mode
      const exportOptions = buildExportOptions(exportMode, backendAssetTypes);
      
      const result = await exportApi.startExportJob(exportOptions);
      
      if (result?.jobId) {
        setCurrentJobId(result.jobId);
        localStorage.setItem('lastExportJobId', result.jobId);
        
        setJobStatus({
          status: 'queued',
          progress: 0,
          message: 'Export job queued...',
        });
        
        enqueueSnackbar(`Export job started: ${result.jobId}`, { variant: 'success' });
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error('Failed to start export:', error);
      enqueueSnackbar(errorMessage, { variant: 'error' });
      setIsRunning(false);
    }
  }, [isRunning, enqueueSnackbar]);
  
  // Stop export job
  const stopExport = useCallback(async () => {
    if (!currentJobId || !isRunning) return;
    
    try {
      enqueueSnackbar('Stopping export...', { variant: 'info' });
      await exportApi.stopJob(currentJobId);
      
      setJobStatus(prev => prev ? { ...prev, status: 'stopping' } : null);
      enqueueSnackbar('Export stop requested', { variant: 'success' });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error('Failed to stop export:', error);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  }, [currentJobId, isRunning, enqueueSnackbar]);
  
  // Manual refresh
  const refreshStatus = useCallback(async () => {
    if (isRefreshing || !currentJobId) return;
    
    setIsRefreshing(true);
    try {
      await loadJobStatus(currentJobId);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, currentJobId, loadJobStatus]);
  
  // Load last job from localStorage on mount (but not if viewing historical)
  useEffect(() => {
    if (isViewingHistorical) return;
    
    const storedJobId = localStorage.getItem('lastExportJobId');
    if (storedJobId) {
      setCurrentJobId(storedJobId);
      
      // Load status directly without depending on loadJobStatus to avoid circular deps
      const loadInitialStatus = async () => {
        try {
          const status = await exportApi.getJobStatus(storedJobId);
          if (!status) return;
          
          setJobStatus({
            status: status.status,
            progress: status.progress || 0,
            message: status.message,
            stats: status.stats
          });
          
          // Load logs
          try {
            const logsData = await exportApi.getJobLogs(storedJobId);
            if (logsData?.logs) {
              setExportLogs(logsData.logs);
            }
          } catch {
            // Silently fail - logs might not be available yet
          }
          
          // Update running state based on job status
          const isComplete = ['completed', 'failed', 'stopped'].includes(status.status);
          if (isComplete) {
            setIsRunning(false);
            // Don't show completion toasts for jobs loaded from storage
            if (status.status === 'completed') {
              onCacheSummaryUpdate();
            }
          }
        } catch (error) {
          // Handle job not found
          if (isNetworkError(error) && error.response?.status && [400, 404].includes(error.response.status)) {
            localStorage.removeItem('lastExportJobId');
            setCurrentJobId(null);
            setJobStatus(null);
          }
        }
      };
      
      loadInitialStatus();
    }
  }, [isViewingHistorical, onCacheSummaryUpdate]); // Re-run when historical viewing changes
  
  // Poll for job status (only for active jobs, not historical)
  useEffect(() => {
    if (!isRunning || !currentJobId || isViewingHistorical) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const status = await exportApi.getJobStatus(currentJobId);
        if (!status) return;
        
        setJobStatus({
          status: status.status,
          progress: status.progress || 0,
          message: status.message,
          stats: status.stats
        });
        
        // Load logs for all jobs (running or completed)
        try {
          const logsData = await exportApi.getJobLogs(currentJobId);
          if (logsData?.logs) {
            setExportLogs(logsData.logs);
          }
        } catch {
          // Silently fail - logs might not be available yet
        }
        
        // Update running state based on job status
        const isComplete = ['completed', 'failed', 'stopped'].includes(status.status);
        if (isComplete) {
          setIsRunning(false);
          
          if (status.status === 'completed' && jobStartedInSession) {
            enqueueSnackbar('Export completed successfully!', { variant: 'success' });
            onCacheSummaryUpdate();
          } else if (status.status === 'failed' && jobStartedInSession) {
            enqueueSnackbar('Export failed. Check logs for details.', { variant: 'error' });
          }
          
          // Reset the session flag when job completes
          if (jobStartedInSession) {
            setJobStartedInSession(false);
          }
        }
      } catch (error) {
        // Handle job not found
        if (isNetworkError(error) && error.response?.status && [400, 404].includes(error.response.status)) {
          const storedJobId = localStorage.getItem('lastExportJobId');
          if (storedJobId === currentJobId) {
            localStorage.removeItem('lastExportJobId');
          }
          setCurrentJobId(null);
          setJobStatus(null);
          setIsRunning(false);
        }
      }
    }, 5000);
    
    return () => clearInterval(pollInterval);
  }, [isRunning, currentJobId, isViewingHistorical, jobStartedInSession, enqueueSnackbar, onCacheSummaryUpdate]);
  
  // Load historical job details
  const loadHistoricalJob = useCallback(async (jobId: string) => {
    try {
      // Mark as viewing historical job and stop monitoring
      setIsViewingHistorical(true);
      setIsRunning(false);
      setJobStartedInSession(false);
      
      // Load job status
      const status = await exportApi.getJobStatus(jobId);
      if (status) {
        setJobStatus({
          status: status.status,
          progress: status.progress || 0,
          message: status.message,
          stats: status.stats
        });
      }
      
      // Load logs
      const logsData = await exportApi.getJobLogs(jobId);
      if (logsData?.logs) {
        setExportLogs(logsData.logs);
      }
      
      // Update current job ID but don't save to localStorage
      setCurrentJobId(jobId);
      
    } catch (error) {
      console.error('Failed to load historical job:', error);
    }
  }, []);

  return {
    currentJobId,
    jobStatus,
    isRunning,
    exportLogs,
    isRefreshing,
    startExport,
    stopExport,
    refreshStatus,
    loadHistoricalJob,
  };
}