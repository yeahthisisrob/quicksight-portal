/**
 * Shared API types and client
 * Single source of truth for API contracts
 */

// Export all types
export * from './types';
export * from './api-client';

// Re-export commonly used types for convenience
export type {
  AssetListItem,
  FolderListItem,
  FolderDetails,
  FolderMember,
  DashboardListItem,
  DatasetListItem,
  UserListItem,
  AssetLineage,
  LineageRelationship,
  FieldInfo,
  Tag,
  AssetType,
  AssetStatus,
  EnrichmentStatus,
} from './api-client';