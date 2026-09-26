export interface PermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  assetType: string;
  permissions: any[];
  onPermissionRevoked?: (principal: string) => void;
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
