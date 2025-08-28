// Folder entity types

export interface Folder {
  id: string;
  arn: string;
  name: string;
  folderType: 'SHARED' | 'RESTRICTED';
  path: string[];
  parentFolderId?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  permissions?: FolderPermission[];
  members?: FolderMember[];
}

export interface FolderPermission {
  principal: string;
  principalType: 'USER' | 'GROUP';
  actions: string[];
}

export interface FolderMember {
  memberType: 'DASHBOARD' | 'ANALYSIS' | 'DATASET';
  memberId: string;
  memberArn?: string;
}