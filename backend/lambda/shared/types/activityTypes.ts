/**
 * Shared activity data types used across services
 */

/**
 * General activity data for assets (dashboards, analyses, etc.)
 */
export interface ActivityData {
  totalViews?: number;
  totalActivities?: number;
  lastViewed?: string | null;
  uniqueViewers?: number;
  lastActive?: string | null;
  dashboardCount?: number;
  analysisCount?: number;
}

/**
 * Activity statistics for view tracking
 */
export interface ViewStats {
  totalViews: number;
  uniqueViewers: number;
  lastViewedAt?: string;
  statsRefreshedAt?: string;
}
