/**
 * Refactored RestoreAssetDialog with reduced complexity
 */
import {
  RestoreFromTrash,
  Close,
  Edit,
  Security,
  Tag,
  Info,
  Settings,
  CheckCircle,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import React, { useCallback } from 'react';

import { useDeploymentJob } from '@/features/deployment';

import { BasicInfoTab } from './components/BasicInfoTab';
import { ComponentsTab } from './components/ComponentsTab';
import { JobStatusSection } from './components/JobStatusSection';
import { PermissionsTab } from './components/PermissionsTab';
import { RestoreSummaryAlert } from './components/RestoreSummaryAlert';
import { ValidationSection } from './components/ValidationSection';
import { useRestoreDialog } from './hooks/useRestoreDialog';

import type { RestoreAssetDialogProps } from './types';

function TabPanel({ children, value, index }: { children?: React.ReactNode; value: number; index: number }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`restore-tabpanel-${index}`}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const RestoreAssetDialog: React.FC<RestoreAssetDialogProps> = ({
  open,
  onClose,
  onSuccess,
  asset,
}) => {
  const {
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
    // options,
    updateFormData,
    // updateOptions,
    handleValidate,
    buildDeploymentConfig,
  } = useRestoreDialog({ asset, open, onSuccess, onClose });

  // Deployment job management
  const {
    jobStatus,
    jobLogs,
    isPolling,
    startDeployment,
    stopDeployment,
  } = useDeploymentJob({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (error) => {
      console.error('Deployment error:', error);
    },
  });

  // Handle restore action
  const handleRestore = useCallback(async () => {
    if (!asset || !canDeploy) return;
    
    setLoading(true);
    try {
      const config = buildDeploymentConfig();
      await startDeployment(asset.type, asset.id, config);
    } catch (error) {
      console.error('Failed to start deployment:', error);
    } finally {
      setLoading(false);
    }
  }, [asset, canDeploy, setLoading, buildDeploymentConfig, startDeployment]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (!loading && !validating && !isPolling) {
      onClose();
      setActiveTab(0);
    }
  }, [loading, validating, isPolling, onClose, setActiveTab]);

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (!asset) return null;

  const hasRequiredFields = !!formData.assetId && !!formData.assetName;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '600px' } }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestoreFromTrash color="primary" />
            <Typography variant="h6">Restore {asset.type}: {asset.name}</Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={loading || validating}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <RestoreSummaryAlert asset={asset} assetMetadata={assetMetadata} />

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab icon={<Edit />} label="Basic Info" iconPosition="start" />
            <Tab icon={<Security />} label="Permissions" iconPosition="start" />
            <Tab icon={<Tag />} label="Tags" iconPosition="start" />
            <Tab icon={<Info />} label="Components" iconPosition="start" />
            <Tab icon={<Settings />} label="Options" iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <BasicInfoTab
            asset={asset}
            formData={formData}
            metadata={assetMetadata}
            onChange={updateFormData}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <PermissionsTab metadata={assetMetadata} loadingMetadata={loadingMetadata} />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Tags tab content - to be implemented */}
          <Typography>Tags configuration</Typography>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <ComponentsTab asset={asset} metadata={assetMetadata} loadingMetadata={loadingMetadata} />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          {/* Options tab content - to be implemented */}
          <Typography>Restore options</Typography>
        </TabPanel>

        {/* Validation Results */}
        {validationResults.length > 0 && (
          <ValidationSection
            validationResults={validationResults}
            validating={validating}
            hasRequiredFields={hasRequiredFields}
          />
        )}

        {/* Job Status */}
        {jobStatus && (
          <JobStatusSection
            jobStatus={jobStatus}
            jobLogs={jobLogs}
            isPolling={isPolling}
            onStop={stopDeployment}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={loading || isPolling}>
          Cancel
        </Button>
        
        <Button
          onClick={handleValidate}
          disabled={!hasRequiredFields || validating || loading || isPolling}
          startIcon={validating ? <CircularProgress size={16} /> : null}
        >
          {validating ? 'Validating...' : 'Validate'}
        </Button>

        <Button
          onClick={handleRestore}
          variant="contained"
          disabled={!canDeploy || loading || isPolling}
          startIcon={loading ? <CircularProgress size={16} /> : <CheckCircle />}
        >
          {loading ? 'Restoring...' : 'Restore'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};