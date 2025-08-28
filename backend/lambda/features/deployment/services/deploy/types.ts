import { type AssetType } from '../../../../shared/models/asset.model';

/**
 * Deployment types that can be extended in the future
 */
export type DeploymentType =
  | 'restore' // Restore from archive to same account
  | 'template' // Deploy from template with variable substitution
  | 'cross-account' // Deploy to different AWS account
  | 'clone' // Clone existing asset with new ID
  | 'migrate' // Migrate between regions
  | 'backup-restore'; // Restore from external backup

/**
 * Deployment source types
 */
export type DeploymentSource =
  | 'archive' // From archived assets
  | 'template' // From template library
  | 's3' // From S3 location
  | 'active' // From active assets
  | 'external'; // From external source

/**
 * Base deployment configuration
 */
export interface DeploymentConfig {
  deploymentType: DeploymentType;
  source: DeploymentSource;
  target: DeploymentTarget;
  options: DeploymentOptions;
  validation?: ValidationOptions;
}

/**
 * Deployment target configuration
 */
export interface DeploymentTarget {
  accountId?: string; // Target AWS account (defaults to current)
  region?: string; // Target AWS region (defaults to current)
  namespace?: string; // QuickSight namespace (defaults to 'default')
  environment?: string; // Environment tag (dev, staging, prod)
}

/**
 * Common deployment options
 */
export interface DeploymentOptions {
  // Identity options
  id?: string; // Override asset ID
  name?: string; // Override asset name
  description?: string; // Override description

  // Metadata options
  tags?: Array<{ key: string; value: string }>;
  folderPath?: string[]; // Target folder ARNs

  // Behavior options
  skipIfExists?: boolean; // Skip if asset already exists
  overwriteExisting?: boolean; // Overwrite if exists
  validateOnly?: boolean; // Only validate, don't deploy
  dryRun?: boolean; // Simulate deployment

  // Versioning options
  createBackup?: boolean; // Backup existing before overwrite
  backupPrefix?: string; // Backup naming prefix
  versionTag?: string; // Version tag for deployed asset

  // Permission options
  preservePermissions?: boolean; // Keep original permissions
  applyDefaultPermissions?: boolean; // Apply account default permissions
  permissions?: any[]; // Custom permissions to apply

  // Transform options
  transformations?: AssetTransformation[];
  variableSubstitutions?: Record<string, string>;

  // Dependency options
  includeDependencies?: boolean; // Deploy dependent assets
  dependencyStrategy?: 'fail' | 'skip' | 'create';
}

/**
 * Validation options
 */
export interface ValidationOptions {
  checkDependencies?: boolean;
  checkPermissions?: boolean;
  checkQuotas?: boolean;
  checkNaming?: boolean;
  customValidators?: string[];
}

/**
 * Asset transformation configuration
 */
export interface AssetTransformation {
  type: 'rename' | 'replace' | 'regex' | 'custom';
  field: string;
  value?: string;
  pattern?: string;
  replacement?: string;
  transformer?: (value: any) => any;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  deploymentId: string;
  success: boolean;
  deploymentType: DeploymentType;
  assetType: AssetType;
  sourceId: string;
  targetId: string;
  targetName: string;
  targetArn?: string;
  accountId: string;
  region: string;

  // Timing
  startTime: Date;
  endTime: Date;
  durationMs: number;

  // Details
  backupPath?: string;
  validationResults?: ValidationResult[];
  transformationsApplied?: string[];
  dependenciesDeployed?: DeploymentResult[];

  // Status
  status: DeploymentStatus;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'validating'
  | 'deploying'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'skipped';

/**
 * Validation result
 */
export interface ValidationResult {
  validator: string;
  passed: boolean;
  message?: string;
  severity: 'error' | 'warning' | 'info';
  details?: any;
}

/**
 * Deployment manifest for batch operations
 */
export interface DeploymentManifest {
  version: string;
  deployments: DeploymentItem[];
  options: {
    parallel?: boolean;
    stopOnError?: boolean;
    rollbackOnError?: boolean;
  };
}

/**
 * Individual deployment item in manifest
 */
export interface DeploymentItem {
  assetType: AssetType;
  assetId: string;
  config: DeploymentConfig;
  dependencies?: string[];
  priority?: number;
}

/**
 * Deployment strategy interface
 */
export interface IDeploymentStrategy {
  type: DeploymentType;

  validate(
    assetType: AssetType,
    assetId: string,
    assetData: any,
    config: DeploymentConfig
  ): Promise<ValidationResult[]>;

  deploy(
    assetType: AssetType,
    assetId: string,
    assetData: any,
    config: DeploymentConfig
  ): Promise<DeploymentResult>;

  rollback?(deploymentResult: DeploymentResult): Promise<void>;
}
