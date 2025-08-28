/**
 * Hook for managing cache summary state
 */
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';

import { exportApi } from '@/shared/api';

import type { components } from '@shared/generated/types';

type CacheSummary = components['schemas']['ExportSummaryResponse']['data'];

export function useCacheSummary() {
  const { enqueueSnackbar } = useSnackbar();
  
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);
  const [cacheSummaryLoading, setCacheSummaryLoading] = useState(true);
  const [showInitialExportPrompt, setShowInitialExportPrompt] = useState(false);
  
  const loadCacheSummary = useCallback(async () => {
    try {
      setCacheSummaryLoading(true);
      const summary = await exportApi.getExportSummary();
      setCacheSummary(summary || null);
      
      // Check if initial export is needed
      if (summary?.needsInitialExport) {
        setShowInitialExportPrompt(true);
        if (summary.message) {
          enqueueSnackbar(summary.message, { variant: 'info' });
        }
      } else {
        setShowInitialExportPrompt(false);
      }
    } catch {
      enqueueSnackbar('Failed to load cache summary', { variant: 'error' });
    } finally {
      setCacheSummaryLoading(false);
    }
  }, [enqueueSnackbar]);
  
  // Load on mount
  useEffect(() => {
    loadCacheSummary();
  }, [loadCacheSummary]);
  
  return {
    cacheSummary,
    cacheSummaryLoading,
    showInitialExportPrompt,
    setShowInitialExportPrompt,
    loadCacheSummary,
  };
}