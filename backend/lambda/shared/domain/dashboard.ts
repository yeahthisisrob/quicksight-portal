/**
 * Domain model for Dashboard
 * This is our internal business representation
 */
export interface Dashboard {
  id: string;
  name: string;
  arn: string;
  createdTime: Date;
  lastUpdatedTime?: Date;
  lastPublishedTime?: Date;
  publishedVersionNumber?: number;
  status: DashboardStatus;
}

export enum DashboardStatus {
  CREATION_IN_PROGRESS = 'CREATION_IN_PROGRESS',
  CREATION_SUCCESSFUL = 'CREATION_SUCCESSFUL',
  CREATION_FAILED = 'CREATION_FAILED',
  UPDATE_IN_PROGRESS = 'UPDATE_IN_PROGRESS',
  UPDATE_SUCCESSFUL = 'UPDATE_SUCCESSFUL',
  UPDATE_FAILED = 'UPDATE_FAILED',
  DELETED = 'DELETED',
}

export interface DashboardListResult {
  items: Dashboard[];
  nextToken?: string;
}
