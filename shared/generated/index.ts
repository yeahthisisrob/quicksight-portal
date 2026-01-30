/**
 * Shared API types and client
 * Single source of truth for API contracts
 */

// Export the full types structure for advanced usage
export type { paths, components, operations } from './api-client';

// Re-export commonly used types for convenience
// These are extracted from components["schemas"]
import type { components } from './api-client';

export type AssetListItem = components['schemas']['AssetListItem'];
export type FolderListItem = components['schemas']['FolderListItem'];
export type FolderDetails = components['schemas']['FolderDetails'];
export type FolderMember = components['schemas']['FolderMember'];
export type DashboardListItem = components['schemas']['DashboardListItem'];
export type DatasetListItem = components['schemas']['DatasetListItem'];
export type UserListItem = components['schemas']['UserListItem'];
export type AssetLineage = components['schemas']['AssetLineage'];
export type LineageRelationship = components['schemas']['LineageRelationship'];
export type FieldInfo = components['schemas']['FieldInfo'];
export type Tag = components['schemas']['Tag'];
export type AssetType = components['schemas']['AssetType'];
export type AssetStatus = components['schemas']['AssetStatus'];
export type EnrichmentStatus = components['schemas']['EnrichmentStatus'];
