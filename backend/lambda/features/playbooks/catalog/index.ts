/**
 * Every playbook: the ones the portal ships with (a file each, below) and
 * the ones people composed (saved specs, run through the same engine).
 */
import { logger } from '../../../shared/utils/logger';
import { PlaybookSpecStore } from '../spec/PlaybookSpecStore';
import { CUSTOM_PREFIX, specPlaybook } from '../spec/specPlaybook';
import type { Playbook } from '../types';
import { consolidateAthena } from './consolidateAthena';
import { demoCleanup } from './demoCleanup';
import { EXAMPLE_SPECS } from './examples';
import { repairErrors } from './repairErrors';

const BUILT_IN: Playbook[] = [
  repairErrors,
  consolidateAthena,
  demoCleanup,
  ...EXAMPLE_SPECS.map(specPlaybook),
];

/** The shipped specs, to copy and change in the builder. */
export function exampleSpecs() {
  return EXAMPLE_SPECS;
}

export function isCustom(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}

export async function listPlaybooks(store = new PlaybookSpecStore()): Promise<Playbook[]> {
  let custom: Playbook[] = [];
  try {
    custom = (await store.list()).map(specPlaybook);
  } catch (error) {
    // The shipped ones still work when the saved ones cannot be read.
    logger.warn('Saved playbooks could not be read', { error });
  }
  return [...BUILT_IN, ...custom];
}

export async function findPlaybook(
  id: string,
  store = new PlaybookSpecStore()
): Promise<Playbook | undefined> {
  if (!isCustom(id)) return BUILT_IN.find((p) => p.id === id);
  const spec = await store.get(id);
  return spec ? specPlaybook(spec) : undefined;
}
