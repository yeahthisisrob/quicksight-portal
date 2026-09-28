/**
 * What runs after the catalog is rebuilt (an export, an activity refresh):
 * work derived from it that a slice owns, registered by the composition
 * root (worker.ts) so slices never import each other for it.
 */
import { logger } from '../../utils/logger';

const hooks: Array<() => Promise<void>> = [];

/** Run `hook` after every catalog rebuild. Registering one twice has no effect. */
export function onCatalogRebuilt(hook: () => Promise<void>): void {
  if (!hooks.includes(hook)) hooks.push(hook);
}

/** Run every registered hook, in order. A failure is logged, never thrown: derived work must not fail a job. */
export async function runCatalogRebuiltHooks(): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      logger.error('A catalog rebuild hook failed (non-fatal)', { error });
    }
  }
}
