import type { components } from '@shared/generated/types';

export type ActivityData = components['schemas']['ActivityData'];
export type UserActivity = components['schemas']['UserActivity'];

export interface ActivityRefreshOptions {
  assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
  days?: number;
}
