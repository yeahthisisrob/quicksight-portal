import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

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
  status: 'pending' | 'validating' | 'deploying' | 'completed' | 'failed' | 'rolled_back' | 'skipped';
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  validator: string;
  passed: boolean;
  message?: string;
  severity: 'error' | 'warning' | 'info';
  details?: any;
}

/**
 * Deploy API - handles asset deployment operations (restore, template, cross-account, etc.)
 */
export const deployApi = {
  /**
   * Deploy an asset (returns job info for async processing)
   */
  async deployAsset(assetType: string, assetId: string, config: DeploymentConfig): Promise<{ jobId: string; status: string; message: string }> {
    const response = await apiClient.post<ApiResponse<{ jobId: string; status: string; message: string }>>('/deployments', {
      assetType,
      assetId,
      deploymentConfig: config
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to deploy asset');
    }
    
    return response.data.data!;
  },

  /**
   * Validate a deployment without executing it
   */
  async validateDeployment(assetType: string, assetId: string, config: DeploymentConfig): Promise<{
    validationResults: ValidationResult[];
    canDeploy: boolean;
  }> {
    const response = await apiClient.post<ApiResponse<{
      validationResults: ValidationResult[];
      canDeploy: boolean;
    }>>('/deployments/validate', {
      assetType,
      assetId,
      deploymentConfig: config
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to validate deployment');
    }
    
    return response.data.data!;
  },

  /**
   * Get deployment history
   */
  async getDeploymentHistory(limit?: number): Promise<DeploymentResult[]> {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await apiClient.get<ApiResponse<DeploymentResult[]>>('/deployments/history', { params });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get deployment history');
    }
    
    return response.data.data || [];
  },

  /**
   * Get a specific deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<DeploymentResult> {
    const response = await apiClient.get<ApiResponse<DeploymentResult>>(`/deployments/${deploymentId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get deployment');
    }
    
    return response.data.data!;
  }
};