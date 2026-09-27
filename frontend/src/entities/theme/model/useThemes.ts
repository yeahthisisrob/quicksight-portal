import { useQuery } from '@tanstack/react-query';

import { themesApi } from '@/shared/api';
import { BUILT_IN_THEMES, type ThemeListItem } from '@/shared/api/modules/themes';

const THEMES_QUERY_KEY = ['themes-list', 'all'] as const;

/** A theme someone can pick: an account's own, or one of QuickSight's. */
interface ThemeOption {
  /** What the API takes: a custom theme's id, or a built-in's name. */
  id: string;
  name: string;
  builtIn: boolean;
  dataColors: string[];
  usedBy?: ThemeListItem['usedBy'];
}

/** Every theme to choose from, the account's own first. */
function themeOptions(themes: ThemeListItem[]): ThemeOption[] {
  return [
    ...themes.map((t) => ({
      id: t.id,
      name: t.name,
      builtIn: false,
      dataColors: t.dataColors ?? [],
      usedBy: t.usedBy,
    })),
    ...BUILT_IN_THEMES.map((id) => ({
      id,
      name: `${id.charAt(0)}${id.slice(1).toLowerCase()} (QuickSight)`,
      builtIn: true,
      dataColors: [],
    })),
  ];
}

/** The id a theme ARN (or id) names, so a dashboard's theme finds its option. */
export function themeIdOf(themeArnOrId: string | undefined): string | undefined {
  return themeArnOrId?.split('/').pop() || undefined;
}

export function useThemes() {
  const query = useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: () => themesApi.list(),
    staleTime: 2 * 60 * 1000,
  });
  return { ...query, options: themeOptions(query.data ?? []) };
}
