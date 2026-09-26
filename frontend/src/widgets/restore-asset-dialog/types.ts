import type { ArchivedAssetItem } from '@/features/asset-management';

export type { ValidationResult } from '@/shared/api/modules/deploy';

export type { ArchivedAssetItem };

export interface RestoreAssetDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: ArchivedAssetItem | null;
}

export type { AssetMetadata } from '@/features/asset-management';

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
