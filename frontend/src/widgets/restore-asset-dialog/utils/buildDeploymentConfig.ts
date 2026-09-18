/**
 * Utility function to build deployment configuration
 */

import type { DeploymentConfig } from '@/shared/api/modules/deploy';

import type { RestoreFormData, RestoreOptions } from '../types';

export function buildDeploymentConfig(
  formData: RestoreFormData,
  options: RestoreOptions
): DeploymentConfig {
  return {
    deploymentType: 'restore',
    source: 'archive',
    target: {
      accountId: undefined,
      region: undefined,
    },
    options: {
      id: formData.assetId,
      name: formData.assetName,
      description: formData.description || undefined,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      skipIfExists: options.skipIfExists,
      overwriteExisting: options.overwriteExisting,
      createBackup: options.createBackup,
      dryRun: options.dryRun,
      validateOnly: false,
    },
    validation: {
      checkDependencies: true,
      checkPermissions: false,
      checkQuotas: false,
    },
  };
}
