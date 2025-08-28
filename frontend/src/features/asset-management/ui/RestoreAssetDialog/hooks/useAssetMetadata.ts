/**
 * Hook for loading asset metadata
 */
import { useState, useEffect, useCallback } from 'react';

import { assetsApi } from '@/shared/api';

import { buildAssetMetadata } from '../utils/buildAssetMetadata';

import type { ArchivedAssetItem } from '../../../model/types';
import type { AssetMetadata } from '../types';

export function useAssetMetadata(asset: ArchivedAssetItem | null, open: boolean) {
  const [assetMetadata, setAssetMetadata] = useState<AssetMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const loadAssetMetadata = useCallback(async () => {
    if (!asset) return;
    
    setLoadingMetadata(true);
    try {
      const archivedData = await assetsApi.getArchivedAssetMetadata(asset.type, asset.id);
      const metadata = buildAssetMetadata(archivedData, asset);
      setAssetMetadata(metadata);
    } catch (error) {
      console.error('Failed to load asset metadata:', error);
      setAssetMetadata({
        permissions: [],
        tags: asset.tags || [],
      });
    } finally {
      setLoadingMetadata(false);
    }
  }, [asset]);

  useEffect(() => {
    if (asset && open) {
      loadAssetMetadata();
    }
  }, [asset, open, loadAssetMetadata]);

  useEffect(() => {
    if (asset) {
      setAssetMetadata(null);
    }
  }, [asset]);

  return { assetMetadata, loadingMetadata };
}