/**
 * Lineage service interface to break circular dependency
 */
export interface ILineageService {
  rebuildLineage(): Promise<void>;
}

/**
 * Lineage relationship data
 */
export interface LineageRelationship {
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
