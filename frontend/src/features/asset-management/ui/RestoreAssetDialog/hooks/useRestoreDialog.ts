/**
 * Hook for managing RestoreAssetDialog state and logic
 */
import { useState, useEffect, useCallback } from 'react';

import { extractAssetMetadata } from '@/features/asset-management/utils/metadataExtractor';

import { assetsApi, deployApi } from '@/shared/api';

import type { 
  ArchivedAssetItem, 
  AssetMetadata, 
  RestoreFormData, 
  RestoreOptions,
  ValidationResult,
  DeploymentConfig 
} from '../types';

interface UseRestoreDialogProps {
  asset: ArchivedAssetItem | null;
  open: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export function useRestoreDialog({ asset, open }: UseRestoreDialogProps) {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [canDeploy, setCanDeploy] = useState(false);
  const [assetMetadata, setAssetMetadata] = useState<AssetMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Form data
  const [formData, setFormData] = useState<RestoreFormData>({
    assetId: '',
    assetName: '',
    description: '',
    tags: [],
  });

  // Options
  const [options, setOptions] = useState<RestoreOptions>({
    skipIfExists: false,
    overwriteExisting: false,
    createBackup: true,
    dryRun: false,
  });

  // Initialize form data when asset changes
  useEffect(() => {
    if (asset) {
      setFormData({
        assetId: asset.id,
        assetName: asset.name,
        description: '',
        tags: asset.tags || [],
      });
      setValidationResults([]);
      setCanDeploy(false);
      setAssetMetadata(null);
    }
  }, [asset]);

  // Load metadata
  const loadAssetMetadata = useCallback(async () => {
    if (!asset) return;
    
    setLoadingMetadata(true);
    try {
      const archivedData = await assetsApi.getArchivedAssetMetadata(asset.type, asset.id);
      const metadata = extractAssetMetadata(archivedData, asset.type);
      setAssetMetadata(metadata);
    } catch (error) {
      console.error('Failed to load asset metadata:', error);
      setAssetMetadata({
        permissions: [],
        tags: asset.tags || [],
      });
    } finally {
      setLoadingMetadata(false);
    }
  }, [asset]);

  // Load metadata when dialog opens
  useEffect(() => {
    if (asset && open) {
      loadAssetMetadata();
    }
  }, [asset, open, loadAssetMetadata]);

  // Build deployment configuration
  const buildDeploymentConfig = useCallback((): DeploymentConfig => {
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
        ...options,
        validateOnly: false,
      },
      validation: {
        checkDependencies: true,
        checkPermissions: false,
        checkQuotas: false,
      },
    };
  }, [formData, options]);

  // Validate deployment
  const handleValidate = useCallback(async () => {
    if (!asset) return;
    
    setValidating(true);
    setValidationResults([]);
    
    try {
      const config = buildDeploymentConfig();
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
  }, [asset, buildDeploymentConfig]);

  // Auto-validate
  useEffect(() => {
    if (open && asset && formData.assetId && formData.assetName && !validating && !canDeploy) {
      const timer = setTimeout(handleValidate, 100);
      return () => clearTimeout(timer);
    }
  }, [open, asset, formData.assetId, formData.assetName, validating, canDeploy, handleValidate]);

  // Update form data
  const updateFormData = useCallback((updates: Partial<RestoreFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Update options
  const updateOptions = useCallback((updates: Partial<RestoreOptions>) => {
    setOptions(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    // State
    activeTab,
    setActiveTab,
    loading,
    setLoading,
    validating,
    validationResults,
    canDeploy,
    assetMetadata,
    loadingMetadata,
    formData,
    options,
    
    // Actions
    updateFormData,
    updateOptions,
    handleValidate,
    buildDeploymentConfig,
  };
}