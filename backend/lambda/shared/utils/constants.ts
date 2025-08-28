// Portal visibility control tags
export const PORTAL_EXCLUDE_TAGS = {
  EXCLUDE_FROM_CATALOG: 'Portal:ExcludeFromCatalog',
  EXCLUDE_FROM_PORTAL: 'Portal:ExcludeFromPortal',
} as const;

// CloudTrail event names for tracking user activity
export const QUICKSIGHT_USER_ACTIVITY_EVENTS = [
  'GetDashboard',
  'DescribeDashboard',
  'GetDashboardEmbedUrl',
  'GetAnalysis',
] as const;
