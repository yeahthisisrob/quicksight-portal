/**
 * Rebuilding the data catalog after an export, without the export slice
 * depending on the catalog slice: each Lambda's composition root registers
 * the catalog's own rebuild here. Unregistered (a unit test), it does
 * nothing, and says so.
 */
import { logger } from '../../utils/logger';

export interface CatalogIndexer {
  /** Drop the catalog, before a full rebuild of what it is made from. */
  clear(): Promise<void>;
  /** Build the catalog index and the visual field catalog from the field cache. */
  rebuild(): Promise<void>;
}

let registered: CatalogIndexer | null = null;

export function registerCatalogIndexer(indexer: CatalogIndexer): void {
  registered = indexer;
}

export function catalogIndexer(): CatalogIndexer {
  return (
    registered ?? {
      clear: async () => logger.warn('No catalog indexer registered; the catalog was not cleared'),
      rebuild: async () =>
        logger.warn('No catalog indexer registered; the catalog was not rebuilt'),
    }
  );
}
