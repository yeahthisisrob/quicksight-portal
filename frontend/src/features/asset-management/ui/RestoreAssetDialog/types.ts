/**
 * Types for RestoreAssetDialog components
 */
import type { ArchivedAssetItem } from '../../model/types';
import type { ValidationResult } from '@/shared/api/modules/deploy';
import type { ReactNode } from 'react';

export type { ArchivedAssetItem };
export type { ValidationResult } from '@/shared/api/modules/deploy';

export interface RestoreAssetDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: ArchivedAssetItem | null;
}

export interface AssetMetadata {
  permissions?: any[];
  tags?: Array<{ key: string; value: string }>;
  refreshSchedules?: any[];
  refreshProperties?: any;
  folderMemberships?: any[];
  originalName?: string;
  description?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  importMode?: string;
  rowCount?: number;
  consumedSpiceCapacityInBytes?: number;
  [key: string]: any;
}

export interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

export interface RestoreOptions {
  skipIfExists: boolean;
  overwriteExisting: boolean;
  createBackup: boolean;
  dryRun: boolean;
}

export interface RestoreFormData {
  assetId: string;
  assetName: string;
  description: string;
  tags: Array<{ key: string; value: string }>;
}

export interface ValidationSectionProps {
  validationResults: ValidationResult[];
  validating: boolean;
  canDeploy: boolean;
  hasRequiredFields: boolean;
}

export interface JobStatusSectionProps {
  jobStatus: any;
  jobLogs: any[];
  isPolling: boolean;
  onStop: () => void;
}

export interface DeploymentConfig {
  deploymentType: 'restore';
  source: 'archive';
  target: {
    accountId?: string;
    region?: string;
  };
  options: {
    id: string;
    name: string;
    description?: string;
    tags?: Array<{ key: string; value: string }>;
    skipIfExists: boolean;
    overwriteExisting: boolean;
    createBackup: boolean;
    dryRun: boolean;
    validateOnly: boolean;
  };
  validation: {
    checkDependencies: boolean;
    checkPermissions: boolean;
    checkQuotas: boolean;
  };
}