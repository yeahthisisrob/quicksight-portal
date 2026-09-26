/**
 * Lineage relationship data
 */
interface LineageRelationship {
  relationshipType: string;
  targetAssetType: string;
  targetAssetId: string;
  targetAssetName: string;
}

/**
 * Lineage data for an asset
 */
export interface LineageData {
  relationships?: LineageRelationship[];
}
