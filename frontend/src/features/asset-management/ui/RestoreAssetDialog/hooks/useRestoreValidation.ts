/**
 * Hook for restore validation logic
 */
import { useState, useEffect, useCallback } from 'react';

import { deployApi } from '@/shared/api';

import { buildDeploymentConfig } from '../utils/buildDeploymentConfig';

import type { ArchivedAssetItem } from '../../../model/types';
import type { RestoreFormData, RestoreOptions } from '../types';
import type { ValidationResult } from '@/shared/api/modules/deploy';


export function useRestoreValidation(
  asset: ArchivedAssetItem | null,
  formData: RestoreFormData,
  options: RestoreOptions,
  open: boolean
) {
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [canDeploy, setCanDeploy] = useState(false);

  const handleValidate = useCallback(async () => {
    if (!asset) return;
    
    setValidating(true);
    setValidationResults([]);
    
    try {
      const config = buildDeploymentConfig(formData, options);
      const result = await deployApi.validateDeployment(asset.type, asset.id, config);
      
      setValidationResults(result.validationResults);
      setCanDeploy(result.canDeploy);
    } catch (error: any) {
      setValidationResults([{
        validator: 'general',
        passed: false,
        message: error.message || 'Validation failed',
        severity: 'error',
      }]);
      setCanDeploy(false);
    } finally {
      setValidating(false);
    }
  }, [asset, formData, options]);

  // Auto-validate when dialog opens with valid data
  useEffect(() => {
    if (open && asset && formData.assetId && formData.assetName && !validating && !canDeploy) {
      const timer = setTimeout(handleValidate, 100);
      return () => clearTimeout(timer);
    }
  }, [open, asset, formData.assetId, formData.assetName, validating, canDeploy, handleValidate]);

  // Reset validation when asset changes
  useEffect(() => {
    if (asset) {
      setValidationResults([]);
      setCanDeploy(false);
    }
  }, [asset]);

  return {
    validating,
    validationResults,
    canDeploy,
    handleValidate,
  };
}