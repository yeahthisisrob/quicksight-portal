/**
 * The theme every dashboard and analysis the portal builds from nothing
 * wears (the `authoring.defaultTheme` setting), picked where the themes are.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { ThemePicker } from '@/entities/theme';

import { settingsApi } from '@/shared/api';
import {
  SETTINGS_SNAPSHOT_QUERY_KEY,
  settingValue,
  useSettingsSnapshot,
} from '@/shared/lib/useSettingsSnapshot';

const DEFAULT_THEME_KEY = 'authoring.defaultTheme';

export function DefaultThemeControl() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const current = settingValue(useSettingsSnapshot().data, DEFAULT_THEME_KEY);
  const save = useMutation({
    mutationFn: (theme: string) =>
      settingsApi.update({ values: { [DEFAULT_THEME_KEY]: theme || null } }),
    onSuccess: (_, theme) => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_SNAPSHOT_QUERY_KEY });
      enqueueSnackbar(
        theme
          ? `New dashboards and analyses will wear ${theme}`
          : 'New dashboards and analyses will wear QuickSight’s default theme',
        { variant: 'success' }
      );
    },
  });

  return (
    <ThemePicker
      label="Theme for new assets"
      emptyLabel="QuickSight’s default"
      value={typeof current === 'string' ? current : ''}
      onChange={(theme) => save.mutate(theme)}
      width={260}
    />
  );
}
