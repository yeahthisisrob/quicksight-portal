import { assetsApi, tagsApi } from '@/shared/api';

import { AssetType, BaseAsset } from '../model';

// Asset-specific API methods that work with typed entities
export const assetApi = {
  // Get single asset details
  async getAssetDetails(type: AssetType, id: string): Promise<BaseAsset> {
    return await assetsApi.getAsset(type, id);
  },

  // Update asset tags
  async updateAssetTags(type: AssetType, id: string, tags: Array<{ key: string; value: string }>) {
    await tagsApi.updateResourceTags(type as any, id, tags);
    return { success: true };
  },

  // Get asset permissions
  async getAssetPermissions(_type: AssetType, _id: string) {
    return [];
  },

  // Update asset permissions
  async updateAssetPermissions(_type: AssetType, _id: string, _permissions: any[]) {
    return { success: true };
  }
};