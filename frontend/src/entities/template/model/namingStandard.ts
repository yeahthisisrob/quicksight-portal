/**
 * The calculated-field naming standard: one prefix for fields defined in an
 * analysis or dashboard, another for fields defined in a dataset, so a name
 * says where the field lives wherever it is used. Both are Settings
 * (group `guidance`), so the Assistant and the planner name fields the same
 * way; Studio's Templates view edits them.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/shared/api';
import {
  SETTINGS_SNAPSHOT_QUERY_KEY,
  settingValue,
  useSettingsSnapshot,
} from '@/shared/lib/useSettingsSnapshot';

/** Where a calculated field is defined. */
export type FieldHome = 'exploration' | 'dataset';

export interface NamingStandard {
  /** Analyses and dashboards. */
  calcFieldPrefix: string;
  /** Datasets. */
  datasetCalcFieldPrefix: string;
}

const NAMING_KEYS: Record<keyof NamingStandard, string> = {
  calcFieldPrefix: 'guidance.calcFieldPrefix',
  datasetCalcFieldPrefix: 'guidance.datasetCalcFieldPrefix',
};

/** What the server defaults to, for before the snapshot loads. */
export const DEFAULT_NAMING: NamingStandard = {
  calcFieldPrefix: 'c_',
  datasetCalcFieldPrefix: 'c_ds_',
};

/** The same rule the server checks: letters, digits, underscores, starting with a letter. */
export const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,15}$/;

function prefixFor(standard: NamingStandard, home: FieldHome): string {
  return home === 'dataset' ? standard.datasetCalcFieldPrefix : standard.calcFieldPrefix;
}

/**
 * Does the name follow the standard for where it lives? A dataset prefix
 * that starts with the exploration one (c_ds_ and c_) must not let a dataset
 * field pass as an exploration field, so the longer prefix is checked first.
 */
export function followsStandard(name: string, home: FieldHome, standard: NamingStandard): boolean {
  const own = prefixFor(standard, home);
  const other = prefixFor(standard, home === 'dataset' ? 'exploration' : 'dataset');
  if (!own || !name.startsWith(own)) {
    return false;
  }
  // "c_ds_margin" starts with "c_" too, but it is named as a dataset field.
  return !(other.length > own.length && other.startsWith(own) && name.startsWith(other));
}

/** "Net Margin %" -> "net_margin". */
function snakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * The name the standard gives a field: either prefix already on it comes
 * off, the rest is snake_case, and the prefix for where it lives goes on.
 */
export function standardName(name: string, home: FieldHome, standard: NamingStandard): string {
  const prefixes = [standard.datasetCalcFieldPrefix, standard.calcFieldPrefix]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const bare = prefixes.reduce(
    (rest, prefix) => (rest.startsWith(prefix) ? rest.slice(prefix.length) : rest),
    name
  );
  return `${prefixFor(standard, home)}${snakeCase(bare) || 'field'}`;
}

function readPrefix(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** The standard from Settings, and a save that writes both prefixes. */
export function useNamingStandard() {
  const snapshot = useSettingsSnapshot();
  const queryClient = useQueryClient();
  const standard: NamingStandard = {
    calcFieldPrefix: readPrefix(
      settingValue(snapshot.data, NAMING_KEYS.calcFieldPrefix),
      DEFAULT_NAMING.calcFieldPrefix
    ),
    datasetCalcFieldPrefix: readPrefix(
      settingValue(snapshot.data, NAMING_KEYS.datasetCalcFieldPrefix),
      DEFAULT_NAMING.datasetCalcFieldPrefix
    ),
  };
  const save = useMutation({
    mutationFn: (next: NamingStandard) =>
      settingsApi.update({
        values: {
          [NAMING_KEYS.calcFieldPrefix]: next.calcFieldPrefix,
          [NAMING_KEYS.datasetCalcFieldPrefix]: next.datasetCalcFieldPrefix,
        },
      }),
    onSuccess: (next) => queryClient.setQueryData(SETTINGS_SNAPSHOT_QUERY_KEY, next),
  });
  return { standard, loading: snapshot.isLoading, save };
}
