import { components } from '@shared/generated/types';

export type ActivityData = components['schemas']['ActivityData'];
export type UserActivity = components['schemas']['UserActivity'];

export interface ActivityState {
  refreshing: boolean;
  lastRefreshed: Date | null;
  error: string | null;
}

export interface ActivityRefreshOptions {
  assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
  days?: number;
}