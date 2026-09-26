import { useQuery } from '@tanstack/react-query';

import { type SettingsSnapshot, settingsApi } from '@/shared/api/modules/settings';

/** Same key the Settings form uses, so a save there is seen here at once. */
export const SETTINGS_SNAPSHOT_QUERY_KEY = ['settings'] as const;

/** The settings snapshot: one cheap read, no catalog sweep. */
export function useSettingsSnapshot() {
  return useQuery<SettingsSnapshot>({
    queryKey: SETTINGS_SNAPSHOT_QUERY_KEY,
    queryFn: () => settingsApi.get(),
    retry: 1,
  });
}

/** One setting's resolved value from the snapshot, if the snapshot has it. */
export function settingValue(
  snapshot: SettingsSnapshot | undefined,
  key: string
): SettingsSnapshot['groups'][number]['settings'][number]['value'] | undefined {
  for (const group of snapshot?.groups ?? []) {
    const setting = group.settings.find((s) => s.key === key);
    if (setting) {
      return setting.value;
    }
  }
  return undefined;
}
