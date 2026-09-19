import { SmusGate } from '@/entities/smus';
import { CatalogTabsPage } from '@/features/data-catalog';

/**
 * The catalog, field-first: calculated fields and their lineage, columns tied
 * to SMUS, and the per-project SMUS assets - only with an active project.
 */
export default function DataCatalogPage() {
  return (
    <SmusGate subject="The catalog">
      <CatalogTabsPage />
    </SmusGate>
  );
}
