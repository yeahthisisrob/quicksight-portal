import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { assetsApi, jobsApi } from '@/shared/api';
import { useJobPolling } from '@/shared/hooks/useJobPolling';

import { downloadCSV } from './exportUtils';

export function useExportCSV(assetType: string, assetLabel: string) {
  const { enqueueSnackbar } = useSnackbar();
  const [isExporting, setIsExporting] = useState(false);

  // Handle job completion - download the CSV from job result
  const handleJobComplete = useCallback(
    async (job: any) => {
      try {
        // Get the job result which contains the CSV data
        const result = await jobsApi.getJobResult(job.jobId);

        if (result && result.csv && result.filename) {
          downloadCSV(result.csv, result.filename);
          enqueueSnackbar(
            `Export completed! ${result.count || 0} ${assetLabel.toLowerCase()} exported.`,
            { variant: 'success' }
          );
        } else {
          enqueueSnackbar('Export completed but no data was returned', { variant: 'warning' });
        }
      } catch (error) {
        console.error('Failed to download CSV export:', error);
        enqueueSnackbar('Export completed but download failed', { variant: 'error' });
      } finally {
        setIsExporting(false);
      }
    },
    [assetLabel, enqueueSnackbar]
  );

  // Handle job failure
  const handleJobFailed = useCallback(
    (job: any) => {
      enqueueSnackbar(job.error || 'Export failed', { variant: 'error' });
      setIsExporting(false);
    },
    [enqueueSnackbar]
  );

  // Set up job polling
  const { startPolling } = useJobPolling({
    onComplete: handleJobComplete,
    onFailed: handleJobFailed,
  });

  // Start the export
  const handleExportCSV = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      enqueueSnackbar(`Starting export of all ${assetLabel.toLowerCase()}...`, { variant: 'info' });

      // Queue the CSV export job
      const response = await assetsApi.exportAssets(assetType);

      if (response.jobId) {
        enqueueSnackbar(`Export job queued (Job ID: ${response.jobId})`, { variant: 'info' });
        startPolling(response.jobId);
      } else {
        enqueueSnackbar('Export request failed - no job ID returned', { variant: 'error' });
        setIsExporting(false);
      }
    } catch (error) {
      console.error('Failed to start export:', error);
      enqueueSnackbar('Failed to start export', { variant: 'error' });
      setIsExporting(false);
    }
  }, [assetType, assetLabel, enqueueSnackbar, isExporting, startPolling]);

  return handleExportCSV;
}
