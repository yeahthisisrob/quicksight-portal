// User entity types

export interface User {
  userName: string;
  arn: string;
  email?: string;
  role: UserRole;
  identityType: 'IAM' | 'QUICKSIGHT';
  active: boolean;
  principalId?: string;
  customPermissionsName?: string;
  groups?: string[];
  createdTime?: string;
  lastActiveTime?: string;
}

export type UserRole = 'ADMIN' | 'AUTHOR' | 'READER' | 'RESTRICTED_AUTHOR' | 'RESTRICTED_READER';

export interface UserGroup {
  groupName: string;
  arn: string;
  description?: string;
  principalId?: string;
  memberCount?: number;
}