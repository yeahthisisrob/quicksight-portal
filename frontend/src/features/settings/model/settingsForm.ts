/**
 * The settings form's state, as pure functions.
 *
 * A draft holds only what the user changed: a new value, or `null` meaning
 * "clear the stored value so it falls back to the environment". Everything
 * else is read from the last snapshot the server sent. That keeps the save
 * request honest about intent, and the "n changes" count exact.
 */
import type {
  SettingDefinition,
  SettingsSnapshot,
  SettingsUpdate,
} from '@/shared/api/modules/settings';

export type SettingValue = string | boolean | string[];

/** Key -> new value, or null to reset. Absent keys are untouched. */
export type SettingsDraft = Record<string, SettingValue | null>;

export type SettingsFormAction =
  | { type: 'set'; key: string; value: SettingValue }
  | { type: 'reset'; key: string }
  | { type: 'revert'; key: string }
  | { type: 'discard' };

export function definitionsOf(snapshot: SettingsSnapshot | null | undefined): SettingDefinition[] {
  return snapshot?.groups.flatMap((g) => g.settings) ?? [];
}

export function findDefinition(
  snapshot: SettingsSnapshot | null | undefined,
  key: string
): SettingDefinition | undefined {
  return definitionsOf(snapshot).find((d) => d.key === key);
}

export function valuesEqual(a: SettingValue | undefined, b: SettingValue | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? [...a].sort() : null;
    const right = Array.isArray(b) ? [...b].sort() : null;
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return a === b;
}

/**
 * Apply an action to the draft. Setting a stored value back to what the
 * server has drops the key, so an undo by hand counts as no change.
 */
export function settingsFormReducer(
  draft: SettingsDraft,
  action: SettingsFormAction,
  snapshot: SettingsSnapshot | null | undefined
): SettingsDraft {
  switch (action.type) {
    case 'set': {
      const definition = findDefinition(snapshot, action.key);
      const unchanged =
        definition?.source === 'stored' && valuesEqual(definition.value, action.value);
      if (unchanged) {
        const { [action.key]: _dropped, ...rest } = draft;
        return rest;
      }
      return { ...draft, [action.key]: action.value };
    }
    case 'reset': {
      const definition = findDefinition(snapshot, action.key);
      if (definition && definition.source !== 'stored') {
        // Nothing stored to clear; resetting is a no-op, not a change.
        const { [action.key]: _dropped, ...rest } = draft;
        return rest;
      }
      return { ...draft, [action.key]: null };
    }
    case 'revert': {
      const { [action.key]: _dropped, ...rest } = draft;
      return rest;
    }
    case 'discard':
      return {};
  }
}

export function changedKeys(draft: SettingsDraft): string[] {
  return Object.keys(draft);
}

export function isDirty(draft: SettingsDraft): boolean {
  return changedKeys(draft).length > 0;
}

/** What the field should show: the draft if touched, else the server's value. */
export function displayValue(
  definition: SettingDefinition,
  draft: SettingsDraft
): SettingValue | null | undefined {
  return definition.key in draft ? draft[definition.key] : definition.value;
}

export function toUpdate(draft: SettingsDraft): SettingsUpdate {
  return { values: { ...draft } };
}
