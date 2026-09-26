import type { components, paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';

export interface DeploymentConfig {
  deploymentType: 'restore' | 'template' | 'cross-account' | 'clone' | 'migrate' | 'backup-restore';
  source: 'archive' | 'template' | 's3' | 'active' | 'external';
  target: {
    accountId?: string;
    region?: string;
    namespace?: string;
    environment?: string;
  };
  options: {
    id?: string;
    name?: string;
    description?: string;
    tags?: Array<{ key: string; value: string }>;
    folderPath?: string[];
    skipIfExists?: boolean;
    overwriteExisting?: boolean;
    validateOnly?: boolean;
    dryRun?: boolean;
    createBackup?: boolean;
    backupPrefix?: string;
    versionTag?: string;
    preservePermissions?: boolean;
    applyDefaultPermissions?: boolean;
    permissions?: any[];
    transformations?: any[];
    variableSubstitutions?: Record<string, string>;
    includeDependencies?: boolean;
    dependencyStrategy?: 'fail' | 'skip' | 'create';
  };
  validation?: {
    checkDependencies?: boolean;
    checkPermissions?: boolean;
    checkQuotas?: boolean;
    checkNaming?: boolean;
    customValidators?: string[];
  };
}

export interface DeploymentResult {
  deploymentId: string;
  success: boolean;
  deploymentType: string;
  assetType: string;
  sourceId: string;
  targetId: string;
  targetName: string;
  targetArn?: string;
  accountId: string;
  region: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  backupPath?: string;
  validationResults?: ValidationResult[];
  transformationsApplied?: string[];
  status:
    | 'pending'
    | 'validating'
    | 'deploying'
    | 'completed'
    | 'failed'
    | 'rolled_back'
    | 'skipped';
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export type ValidationResult = components['schemas']['DeploymentValidationResult'];
export type DeployableAssetType =
  paths['/api/deployments']['post']['requestBody']['content']['application/json']['assetType'];

/**
 * Deploy API - handles asset deployment operations (restore, template, cross-account, etc.)
 */
export const deployApi = {
  /** Queues the deployment as a job; follow it by its jobId. */
  async deployAsset(assetType: DeployableAssetType, assetId: string, config: DeploymentConfig) {
    return unwrap(
      await client.POST('/api/deployments', {
        body: { assetType, assetId, deploymentConfig: { ...config } },
      }),
      'Failed to deploy asset'
    );
  },

  /** Validate a deployment without executing it. */
  async validateDeployment(
    assetType: DeployableAssetType,
    assetId: string,
    config: DeploymentConfig
  ) {
    return unwrap(
      await client.POST('/api/deployments/validate', {
        body: { assetType, assetId, deploymentConfig: { ...config } },
      }),
      'Failed to validate deployment'
    );
  },
};
