import { useSnackbar } from 'notistack';
import { useState, useCallback } from 'react';

import { api } from '@/shared/api';

interface UseTagRefreshOptions {
  assets: any[];
  assetType: 'dashboard' | 'analysis' | 'dataset' | 'datasource';
  onRefresh: () => void;
  updateAssetTags?: (assetId: string, tags: any[]) => void;
}

export function useTagRefresh({ 
  assets, 
  assetType, 
  onRefresh,
  updateAssetTags 
}: UseTagRefreshOptions) {
  const { enqueueSnackbar } = useSnackbar();
  const [refreshingTags, setRefreshingTags] = useState(false);

  const refreshTags = useCallback(async () => {
    setRefreshingTags(true);
    
    try {
      const assetIds = assets.map(asset => asset.id);
      const response = await api.post(`/quicksight/${assetType}s/refresh-tags`, {
        [`${assetType}Ids`]: assetIds,
      });

      if (response.data.updatedTags && updateAssetTags) {
        // Update tags in local state
        Object.entries(response.data.updatedTags).forEach(([assetId, tags]) => {
          updateAssetTags(assetId, Array.isArray(tags) ? tags : []);
        });
      }

      const updatedCount = Object.keys(response.data.updatedTags || {}).length;
      const errorCount = response.data.errors?.length || 0;

      if (updatedCount > 0) {
        enqueueSnackbar(
          `Successfully refreshed tags for ${updatedCount} ${assetType}${updatedCount !== 1 ? 's' : ''}`,
          { variant: 'success' }
        );
      }

      if (errorCount > 0) {
        enqueueSnackbar(
          `Failed to refresh tags for ${errorCount} ${assetType}${errorCount !== 1 ? 's' : ''}`,
          { variant: 'error' }
        );
      }

      if (updatedCount === 0 && errorCount === 0) {
        enqueueSnackbar('No tags to update', { variant: 'info' });
      }

      // Refresh the table to show updated tags
      onRefresh();
    } catch (_error) {
      enqueueSnackbar(`Failed to refresh ${assetType} tags`, { variant: 'error' });
    } finally {
      setRefreshingTags(false);
    }
  }, [assets, assetType, enqueueSnackbar, onRefresh, updateAssetTags]);

  return {
    refreshTags,
    refreshingTags,
  };
}