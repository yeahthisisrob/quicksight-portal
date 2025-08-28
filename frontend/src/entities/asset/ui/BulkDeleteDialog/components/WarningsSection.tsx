/**
 * Warnings section component for BulkDeleteDialog
 */
import { Alert, AlertTitle, Typography } from '@mui/material';

import { statusIcons } from '@/shared/ui/icons';

import type { Asset } from '../types';

const WarningIcon = statusIcons.warning;
const InfoIcon = statusIcons.info;

interface WarningsSectionProps {
  hasNonRestorableAssets: boolean;
  assetsWithDependents: Asset[];
}

export function WarningsSection({ 
  hasNonRestorableAssets, 
  assetsWithDependents 
}: WarningsSectionProps) {
  const totalDependents = assetsWithDependents.reduce((sum, asset) => 
    sum + (asset.usedBy?.length || 0), 0);

  return (
    <>
      {/* Critical Warning for Non-Restorable Assets */}
      {hasNonRestorableAssets && (
        <Alert 
          severity="error" 
          icon={<WarningIcon />}
          sx={{
            '& .MuiAlert-icon': {
              fontSize: '1.5rem',
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            Warning: This action includes assets that CANNOT be restored!
          </AlertTitle>
          <Typography variant="body2">
            You are about to permanently delete dashboards, datasets, and/or data sources. 
            These assets cannot be recovered through QuickSight after deletion.
          </Typography>
        </Alert>
      )}

      {/* Warning for Assets with Dependencies */}
      {assetsWithDependents.length > 0 && (
        <Alert severity="warning" icon={<WarningIcon />}>
          <AlertTitle sx={{ fontWeight: 600 }}>
            {assetsWithDependents.length} asset{assetsWithDependents.length > 1 ? 's have' : ' has'} dependent assets
          </AlertTitle>
          <Typography variant="body2">
            Deleting these assets will break {totalDependents} dependent asset{totalDependents > 1 ? 's' : ''}. 
            The dependent assets will show errors when accessed in QuickSight.
          </Typography>
        </Alert>
      )}

      {/* Archive Notification */}
      <Alert severity="info" icon={<InfoIcon />}>
        <AlertTitle>Assets will be archived in this portal</AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          All deleted assets will be archived with their complete JSON metadata in this portal. 
          This archived data can be used to restore assets in the future.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          <strong>Note:</strong> A restore feature using archived JSON is planned but not yet available. 
          Once implemented, you'll be able to recreate any deleted asset from its archived metadata.
        </Typography>
      </Alert>
    </>
  );
}