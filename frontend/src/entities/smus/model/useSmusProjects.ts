import { useQuery } from '@tanstack/react-query';

import { type SettingsSnapshot, settingsApi } from '@/shared/api/modules/settings';

/** Same key the Settings form uses, so a save there is seen here at once. */
const SETTINGS_SNAPSHOT_QUERY_KEY = ['settings'] as const;

/** The settings snapshot: one cheap read, no catalog sweep. */
export function useSettingsSnapshot() {
  return useQuery<SettingsSnapshot>({
    queryKey: SETTINGS_SNAPSHOT_QUERY_KEY,
    queryFn: () => settingsApi.get(),
    retry: 1,
  });
}
