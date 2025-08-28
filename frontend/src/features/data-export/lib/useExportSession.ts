import { useSnackbar } from 'notistack';
import { useState, useCallback } from 'react';

import { assetsApi, exportApi } from '@/shared/api';

import { 
  AssetType, 
  ExportSession, 
  AssetTypeProgress, 
  ExportMode,
  ExportSummary
} from '../model/types';

export function useExportSession() {
  const { enqueueSnackbar } = useSnackbar();
  const [session, setSession] = useState<ExportSession | null>(null);
  const [progress, setProgress] = useState<Record<AssetType, AssetTypeProgress>>({} as Record<AssetType, AssetTypeProgress>);
  const [isRunning, setIsRunning] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);

  const startExport = useCallback(async (selectedTypes: AssetType[], exportMode: ExportMode) => {
    try {
      setIsRunning(true);
      
      // Create session
      const sessionId = Date.now().toString();
      const newSession: ExportSession = {
        id: sessionId,
        status: 'initializing',
        assetTypes: selectedTypes,
        startTime: Date.now(),
      };
      setSession(newSession);

      // Initialize progress for all selected types
      const initialProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
      selectedTypes.forEach(type => {
        initialProgress[type] = {
          status: 'pending',
          stage: 'pending',
        };
      });
      setProgress(initialProgress);

      // Handle different export modes
      if (exportMode === 'force' || exportMode === 'rebuild') {
        // For force/rebuild modes, call the actual backend export endpoint
        setSession(prev => prev ? { ...prev, status: 'processing' } : null);
        
        // Update all types to processing state
        const processingProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
        selectedTypes.forEach(type => {
          processingProgress[type] = {
            status: 'processing',
            stage: 'processing',
          };
        });
        setProgress(processingProgress);

        try {
          // Call the actual backend export endpoint
          const result = await exportApi.triggerFullExport({
            forceRefresh: exportMode === 'force',
            rebuildIndex: exportMode === 'rebuild',
          });

          // Update all types to completed
          const completedProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
          selectedTypes.forEach(type => {
            completedProgress[type] = {
              status: 'completed',
              stage: 'completed',
              processing: {
                processed: (result as any)?.summary?.[type]?.total || 0,
                successful: (result as any)?.summary?.[type]?.succeeded || 0,
                failed: (result as any)?.summary?.[type]?.failed || 0,
                errors: [],
              },
              totalTime: Date.now() - newSession.startTime,
            };
          });
          setProgress(completedProgress);

        } catch (error) {
          // Update all types to failed
          const failedProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
          selectedTypes.forEach(type => {
            failedProgress[type] = {
              status: 'failed',
              stage: 'failed',
              processing: {
                processed: 0,
                successful: 0,
                failed: 1,
                errors: [(error as Error).message],
              }
            };
          });
          setProgress(failedProgress);
          throw error;
        }

      } else {
        // For smart/permissions/tags modes, call backend export with forceRefresh: false
        // This allows the backend to do intelligent cache checking per asset
        setSession(prev => prev ? { ...prev, status: 'processing' } : null);
        
        // Update all types to processing state
        const processingProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
        selectedTypes.forEach(type => {
          processingProgress[type] = {
            status: 'processing',
            stage: 'comparing',
          };
        });
        setProgress(processingProgress);

        try {
          // Call backend export with smart mode (forceRefresh: false)
          // Backend will compare lastUpdatedTime vs cached versions
          const result = await exportApi.triggerFullExport({
            forceRefresh: false, // Smart mode - backend checks cache per asset
            rebuildIndex: false,
          });

          // Update all types to completed
          const completedProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
          selectedTypes.forEach(type => {
            completedProgress[type] = {
              status: 'completed',
              stage: 'completed',
              processing: {
                processed: (result as any)?.summary?.[type]?.total || 0,
                successful: (result as any)?.summary?.[type]?.succeeded || 0,
                failed: (result as any)?.summary?.[type]?.failed || 0,
                errors: [],
              },
              totalTime: Date.now() - newSession.startTime,
            };
          });
          setProgress(completedProgress);

        } catch (error) {
          // Update all types to failed
          const failedProgress: Record<AssetType, AssetTypeProgress> = {} as Record<AssetType, AssetTypeProgress>;
          selectedTypes.forEach(type => {
            failedProgress[type] = {
              status: 'failed',
              stage: 'failed',
              processing: {
                processed: 0,
                successful: 0,
                failed: 1,
                errors: [(error as Error).message],
              }
            };
          });
          setProgress(failedProgress);
          throw error;
        }
      }

      // Mark session as completed
      setSession(prev => prev ? { ...prev, status: 'completed' } : null);
      enqueueSnackbar('Export completed successfully', { variant: 'success' });

    } catch (_error) {
      setSession(prev => prev ? { ...prev, status: 'failed', error: (_error as Error).message } : null);
      enqueueSnackbar('Export failed', { variant: 'error' });
    } finally {
      setIsRunning(false);
    }
  }, [enqueueSnackbar]);

  const stopExport = useCallback(() => {
    setIsRunning(false);
    setSession(prev => prev ? { ...prev, status: 'failed', error: 'Cancelled by user' } : null);
    enqueueSnackbar('Export cancelled', { variant: 'warning' });
  }, [enqueueSnackbar]);

  const loadExportSummary = useCallback(async () => {
    try {
      const summaryData = await assetsApi.getExportSummary();
      setExportSummary(summaryData);
    } catch (_error) {
      enqueueSnackbar('Failed to load export summary', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const refreshViewStats = useCallback(async () => {
    try {
      await assetsApi.refreshViewStats({ days: 30 });
      await loadExportSummary();
      enqueueSnackbar('View statistics refreshed successfully', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('Failed to refresh view statistics', { variant: 'error' });
    }
  }, [enqueueSnackbar, loadExportSummary]);

  return {
    session,
    progress,
    isRunning,
    exportSummary,
    startExport,
    stopExport,
    loadExportSummary,
    refreshViewStats,
  };
}