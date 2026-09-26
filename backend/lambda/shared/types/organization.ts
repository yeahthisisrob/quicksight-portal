export interface Tag {
  key: string;
  value: string;
}

export interface FolderMetadata {
  description?: string;
  owner?: string;
  category?: string;
  notes?: string;
  lastReviewed?: string;
  reviewedBy?: string;
  businessUnit?: string;
  [key: string]: any;
}

export interface AssetPermission {
  principal: string;
  principalType: 'USER' | 'GROUP';
  actions: string[];
}

export interface User {
  id?: string;
  userId?: string;
  userName: string;
  email?: string;
  role: string;
  active: boolean;
  identityType?: string;
  principalId?: string;
  arn?: string;
  customPermissionsName?: string;
  externalLoginFederationProviderType?: string;
  externalLoginFederationProviderUrl?: string;
  externalLoginId?: string;
  lastLoginTime?: Date;
  lastActivityTime?: Date;
  activityCount?: number;
  activityByType?: Record<string, number>;
  groups?: string[];
  activityStats?: {
    lastActivityTime?: Date;
    activityCount: number;
    activityByType?: Record<string, number>;
    lastRefreshed?: string;
  };
  activity?: {
    totalActivities: number;
    lastActive: string | null;
    dashboardCount: number;
    analysisCount: number;
  };
}

export interface Group {
  id?: string;
  groupName: string;
  description?: string;
  arn?: string;
  principalId?: string;
  memberCount?: number;
  members?: GroupMember[];
  permissions?: AssetPermission[];
}

export interface GroupMember {
  memberName: string;
  memberType?: 'USER' | 'GROUP';
  memberArn?: string;
}

export interface BulkUserGroupResult {
  successCount?: number;
  errorCount?: number;
  successful?: string[];
  failed?: Array<{
    userName: string;
    error: string;
  }>;
  errors?: Array<{
    userName: string;
    error: string;
  }>;
}

export interface UserActivityRefreshResult {
  usersUpdated: number;
  totalUsers: number;
  processingTimeMs: number;
  errors: Array<{
    userName: string;
    error: string;
  }>;
}

export interface UsersAndGroupsExport {
  users: User[];
  groups: Group[];
  exportTime: string;
}
