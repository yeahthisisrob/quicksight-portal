import { SmusGate } from '@/entities/smus';
import { CatalogPage } from '@/features/data-catalog';

/** The catalog: SMUS-published assets, one project at a time - only with an active project. */
export default function DataCatalogPage() {
  return (
    <SmusGate subject="The catalog">
      <CatalogPage />
    </SmusGate>
  );
}
