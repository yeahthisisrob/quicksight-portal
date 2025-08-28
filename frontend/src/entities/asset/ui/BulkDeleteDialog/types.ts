/**
 * Types for BulkDeleteDialog components
 */

export interface Asset {
  id: string;
  name: string;
  type: 'dashboard' | 'analysis' | 'dataset' | 'datasource';
  uses?: Array<{ id: string; name: string; type: string }>;
  usedBy?: Array<{ id: string; name: string; type: string }>;
}

export interface BulkDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  assets: Asset[];
  onComplete?: () => void;
}

export interface RestorationInfo {
  canRestore: boolean;
  method: string;
  note: string;
  portalRestore: string;
  severity: 'info' | 'warning' | 'error';
}

export const RESTORATION_INFO: Record<string, RestorationInfo> = {
  analysis: {
    canRestore: true,
    method: 'QuickSight: Use "Restore Analysis" operation within 30 days',
    note: 'Only analyses can be restored natively in QuickSight',
    portalRestore: 'Can be recreated from archived JSON when restore feature is available',
    severity: 'info',
  },
  dashboard: {
    canRestore: false,
    method: 'QuickSight: NO native restore after deletion (only version history while active)',
    note: 'Dashboards permanently deleted from QuickSight',
    portalRestore: 'Can be recreated from archived JSON when restore feature is available',
    severity: 'warning',
  },
  dataset: {
    canRestore: false,
    method: 'QuickSight: NO restore capability - permanent deletion',
    note: 'Datasets permanently deleted from QuickSight',
    portalRestore: 'Can be recreated from archived JSON when restore feature is available',
    severity: 'error',
  },
  datasource: {
    canRestore: false,
    method: 'QuickSight: NO restore capability - permanent deletion',
    note: 'Data sources permanently deleted from QuickSight',
    portalRestore: 'Must be manually recreated (connection info in archived JSON)',
    severity: 'error',
  },
};