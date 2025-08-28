// Shared API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}

// Asset types - duplicated from entities to avoid boundary violation
export interface Tag {
  Key: string;
  Value: string;
}

export interface TagInput {
  key: string;
  value: string;
}

export interface Permission {
  principal: string;
  principalType: 'USER' | 'GROUP';
  actions: string[];
}

export interface AssetMetadata {
  description?: string;
  owner?: string;
  businessGlossary?: string;
  dataClassification?: string;
  notes?: string;
  customFields?: Record<string, any>;
}

export interface BaseAsset {
  id: string;
  name: string;
  type: string;
  arn?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  lastPublishedTime?: string;
  status?: string;
  permissions?: Permission[];
  tags?: Tag[];
  folderId?: string;
  folderPath?: string;
  metadata?: AssetMetadata;
}

export interface DashboardInfo extends BaseAsset {
  type: 'dashboard';
  version?: {
    versionNumber?: number;
    status?: string;
    createdTime?: string;
  };
  publishedVersionNumber?: number;
  sheets?: any[];
}

export interface DashboardMetadata extends AssetMetadata {
  // Dashboard-specific metadata (extends base with no additional fields for now)
  dashboardSpecific?: boolean;
}