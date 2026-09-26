// Asset entity types
import type { AssetType as GeneratedAssetType } from '@shared/generated';

// Extend asset type to include frontend-specific types
export type AssetType = GeneratedAssetType | 'folder' | 'user' | 'group';

export interface Permission {
  principal: string;
  principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
  actions: string[];
}

// Related assets types
export interface RelatedAsset {
  id: string;
  name: string;
  type: string;
  relationshipType: string;
  isArchived?: boolean;
  // Activity data for dashboards and analyses
  activity?: {
    totalViews?: number;
    uniqueViewers?: number;
    lastViewed?: string | null;
  };
  // Tags for the asset
  tags?: Array<{ key: string; value: string }>;
}
