export interface PermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: string;
  permissions: any[];
}

export interface RelatedAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: string;
  relatedAssets: any[] | { usedBy?: any[]; uses?: any[] };
}

export interface TagsDialogProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  assetType: string;
  resourceType: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group';
  initialTags?: any[];
  onTagsUpdate?: (tags: any[]) => void;
}