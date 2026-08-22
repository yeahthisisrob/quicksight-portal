/**
 * Basic info tab component for RestoreAssetDialog
 */
import { Divider, Paper, Stack, TextField, Typography } from '@mui/material';

import { colors } from '@/shared/design-system/theme';

import type { AssetMetadata, ArchivedAssetItem, RestoreFormData } from '../types';

interface BasicInfoTabProps {
  asset: ArchivedAssetItem;
  metadata: AssetMetadata | null;
  formData: RestoreFormData;
  onChange: (updates: Partial<RestoreFormData>) => void;
}

function formatBytes(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(date: string | undefined): string {
  return date ? new Date(date).toLocaleString() : 'Unknown';
}

export function BasicInfoTab({ asset, metadata, formData, onChange }: BasicInfoTabProps) {
  return (
    <Stack spacing={3}>
      <TextField
        label="Asset ID"
        value={formData.assetId}
        onChange={(e) => onChange({ assetId: e.target.value })}
        fullWidth
        required
        helperText="The ID to restore the asset with"
      />
      
      <TextField
        label="Asset Name"
        value={formData.assetName}
        onChange={(e) => onChange({ assetName: e.target.value })}
        fullWidth
        required
        helperText="The display name for the restored asset"
      />
      
      <TextField
        label="Description"
        value={formData.description}
        onChange={(e) => onChange({ description: e.target.value })}
        fullWidth
        multiline
        rows={3}
        helperText="Optional description for the asset"
      />

      <Paper variant="outlined" sx={{ p: 2, backgroundColor: colors.background.subtle }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Original Asset Information
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            <strong>Type:</strong> {asset.type}
          </Typography>
          <Typography variant="body2">
            <strong>Original ID:</strong> {asset.id}
          </Typography>
          <Typography variant="body2">
            <strong>Created:</strong> {formatDate(asset.createdTime)}
          </Typography>
          <Typography variant="body2">
            <strong>Last Updated:</strong> {formatDate(metadata?.lastUpdatedTime)}
          </Typography>
          <Typography variant="body2">
            <strong>Archived:</strong> {formatDate(asset.archivedDate)}
          </Typography>
          {asset.archiveReason && (
            <Typography variant="body2">
              <strong>Archive Reason:</strong> {asset.archiveReason}
            </Typography>
          )}
          
          {/* Dataset-specific info */}
          {asset.type === 'dataset' && metadata && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">
                <strong>Import Mode:</strong> {metadata.importMode || 'Unknown'}
              </Typography>
              {metadata.rowCount && (
                <Typography variant="body2">
                  <strong>Row Count:</strong> {metadata.rowCount.toLocaleString()}
                </Typography>
              )}
              {metadata.consumedSpiceCapacityInBytes && (
                <Typography variant="body2">
                  <strong>SPICE Usage:</strong> {formatBytes(metadata.consumedSpiceCapacityInBytes)}
                </Typography>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}