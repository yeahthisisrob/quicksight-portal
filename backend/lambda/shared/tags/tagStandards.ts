/**
 * The organisation's tags, from Settings: the keys it uses and the values
 * each may take (for the assistant, which tags with these words), and the
 * tags every asset the portal creates is written with.
 */
import { settingsStore } from '../services/settings/SettingsStore';

export interface TagStandard {
  key: string;
  values: string[];
}

export interface TagPair {
  key: string;
  value: string;
}

/** QuickSight's limits on a tag. */
const KEY_MAX = 128;
const VALUE_MAX = 256;

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

/** "environment: dev, test, prod" per line. A line without values is a key anything may fill. */
export function parseTagStandards(text: string): TagStandard[] {
  return lines(text)
    .map((line) => {
      const [key = '', rest = ''] = line.split(/:(.*)/s);
      return {
        key: key.trim().slice(0, KEY_MAX),
        values: rest
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      };
    })
    .filter((s) => s.key);
}

/** "key=value" per line. */
export function parseTagPairs(text: string): TagPair[] {
  return lines(text)
    .map((line) => {
      const [key = '', value = ''] = line.split(/=(.*)/s);
      return { key: key.trim().slice(0, KEY_MAX), value: value.trim().slice(0, VALUE_MAX) };
    })
    .filter((t) => t.key);
}

export function readTagStandards(get = (k: string) => settingsStore.getString(k)): TagStandard[] {
  return parseTagStandards(get('guidance.tagStandards'));
}

export function readDefaultTags(get = (k: string) => settingsStore.getString(k)): TagPair[] {
  return parseTagPairs(get('authoring.defaultTags'));
}

/** One tag list from several, the later winning on a key (QuickSight refuses duplicates). */
export function mergeTags(...lists: Array<TagPair[] | undefined>): TagPair[] {
  const byKey = new Map<string, TagPair>();
  for (const list of lists) {
    for (const tag of list ?? []) byKey.set(tag.key, tag);
  }
  return [...byKey.values()];
}

/** The standards as a prompt section; '' when none are set. */
export function tagStandardsSection(standards: TagStandard[]): string {
  if (standards.length === 0) return '';
  const rules = standards.map((s) =>
    s.values.length ? `- ${s.key}: one of ${s.values.join(', ')}` : `- ${s.key}: any value`
  );
  return [
    'The organisation\'s tags. Tag with exactly these keys and values; when a request fits none ("mark it as staging" with no staging value), ask which to use rather than inventing one.',
    ...rules,
  ].join('\n');
}
