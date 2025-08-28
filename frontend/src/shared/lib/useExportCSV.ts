import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

import { assetsApi } from '@/shared/api';

import { downloadCSV, generateCSVFilename } from './exportUtils';

export function useExportCSV(assetType: string, assetLabel: string) {
  const { enqueueSnackbar } = useSnackbar();

  const handleExportCSV = useCallback(async () => {
    try {
      enqueueSnackbar(`Starting export of all ${assetLabel.toLowerCase()}...`, { variant: 'info' });
      
      // Call API to export all assets
      const response = await assetsApi.exportAssets(assetType);
      
      // The API returns CSV data directly
      if (response.csv) {
        downloadCSV(response.csv, response.filename || generateCSVFilename(assetLabel.toLowerCase()));
        enqueueSnackbar(`Export completed! ${response.count} ${assetLabel.toLowerCase()} exported.`, { variant: 'success' });
      } else {
        enqueueSnackbar('No data to export', { variant: 'warning' });
      }
    } catch (_error) {
      enqueueSnackbar('Export failed. Please try again.', { variant: 'error' });
    }
  }, [assetType, assetLabel, enqueueSnackbar]);

  return handleExportCSV;
}